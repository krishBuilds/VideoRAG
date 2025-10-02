"""
TransNetV2 Scene Detection Service
Integrates TransNetV2 for scene boundary detection in videos
"""

import os
import json
import logging
import torch
import ffmpeg
from typing import List, Dict, Any, Optional, Tuple
from transnetv2_pytorch import TransNetV2
from .._utils.model_config import get_model_config

logger = logging.getLogger(__name__)

class TransNetV2SceneDetector:
    """
    TransNetV2 based scene detection service
    """

    def __init__(self, model_path: Optional[str] = None, device: Optional[str] = None):
        """
        Initialize TransNetV2 scene detector

        Args:
            model_path: Path to TransNetV2 model weights (if None, uses models directory)
            device: Device to use ('cuda' or 'cpu')
        """
        self.model = None
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')

        # Use model configuration to get proper path
        if model_path is None:
            model_config = get_model_config()
            self.model_path = str(model_config.get_transnetv2_model_path())
        else:
            self.model_path = model_path

        self.model_loaded = False

    def download_model(self) -> str:
        """
        Download TransNetV2 model weights if not exists

        Returns:
            Path to downloaded model
        """
        if os.path.exists(self.model_path):
            logger.info(f"Model already exists at {self.model_path}")
            return self.model_path

        logger.info("Downloading TransNetV2 model weights...")

        try:
            import requests
            url = "https://huggingface.co/MiaoshouAI/transnetv2-pytorch-weights/resolve/main/transnetv2-pytorch-weights.pth"

            response = requests.get(url, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0

            with open(self.model_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            logger.info(f"Downloading: {progress:.1f}%")

            logger.info(f"Model downloaded to {self.model_path}")
            return self.model_path

        except Exception as e:
            logger.error(f"Failed to download model: {str(e)}")
            raise

    def load_model(self) -> None:
        """Load TransNetV2 model"""
        if self.model_loaded:
            return

        try:
            # Download model if not exists
            if not os.path.exists(self.model_path):
                self.download_model()

            logger.info(f"Loading TransNetV2 model on {self.device}")

            # Initialize model
            self.model = TransNetV2(device=self.device)

            # Load weights
            state_dict = torch.load(self.model_path, map_location=self.device)
            self.model.load_state_dict(state_dict)
            self.model.eval()

            self.model_loaded = True
            logger.info("TransNetV2 model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load TransNetV2 model: {str(e)}")
            raise

    def prepare_video(self, video_path: str, target_fps: int = 1, target_height: int = 224) -> str:
        """
        Prepare video for scene detection by resizing and adjusting FPS

        Args:
            video_path: Path to input video
            target_fps: Target FPS for processing
            target_height: Target height for processing

        Returns:
            Path to prepared video
        """
        try:
            # Create output filename
            base_name = os.path.splitext(os.path.basename(video_path))[0]
            output_dir = os.path.join(os.path.dirname(video_path), "prepared")
            os.makedirs(output_dir, exist_ok=True)

            output_path = os.path.join(
                output_dir,
                f"{base_name}_prepared_{target_fps}fps_{target_height}p.mp4"
            )

            # Check if already prepared
            if os.path.exists(output_path):
                logger.info(f"Using already prepared video: {output_path}")
                return output_path

            logger.info(f"Preparing video: {video_path} -> {output_path}")

            # Apply filters
            input_stream = ffmpeg.input(video_path)

            # Filter to adjust FPS and resize
            filtered = input_stream.filter('fps', fps=target_fps)
            filtered = filtered.filter('scale', -2, target_height)  # Preserve aspect ratio

            # Remove audio to save space
            output = filtered.output(
                output_path,
                vcodec='libx264',
                preset='fast',
                acodec='none',
                crf=23,
                vsync='vfr'
            )

            # Run ffmpeg
            ffmpeg.run(output, overwrite_output=True, quiet=True)

            logger.info(f"Video prepared successfully: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error preparing video: {str(e)}")
            raise

    def detect_scenes(
        self,
        video_path: str,
        threshold: float = 0.2,
        min_scene_length: int = 15,
        prepare_video: bool = True,
        min_duration_sec: float = 5.0,
        max_duration_sec: float = 12.0
    ) -> List[Dict[str, Any]]:
        """
        Detect scenes in video using TransNetV2

        Args:
            video_path: Path to video file
            threshold: Scene detection threshold (0.0-1.0)
            min_scene_length: Minimum scene length in frames
            prepare_video: Whether to prepare video for processing

        Returns:
            List of scene dictionaries
        """
        try:
            # Load model if not loaded
            self.load_model()

            # Prepare video if requested
            if prepare_video:
                video_path = self.prepare_video(video_path)

            logger.info(f"Detecting scenes in {video_path} with threshold {threshold}")

            # Run scene detection
            scenes = self.model.detect_scenes(video_path, threshold=threshold)

            # Filter scenes by duration (5-12 seconds)
            filtered_scenes = []
            for scene in scenes:
                duration = scene['end_time'] - scene['start_time']

                # Keep scenes within the desired duration range
                if min_duration_sec <= duration <= max_duration_sec:
                    filtered_scenes.append(scene)
                elif duration > max_duration_sec:
                    # Split long scenes into chunks of max_duration_sec
                    current_time = scene['start_time']
                    scene_id = scene['shot_id']
                    sub_scenes = []

                    while current_time < scene['end_time']:
                        end_time = min(current_time + max_duration_sec, scene['end_time'])
                        sub_duration = end_time - current_time

                        if sub_duration >= min_duration_sec:
                            sub_scenes.append({
                                'shot_id': scene_id,
                                'start_time': current_time,
                                'end_time': end_time,
                                'start_frame': int(current_time * target_fps) if prepare_video else scene['start_frame'],
                                'end_frame': int(end_time * target_fps) if prepare_video else scene['end_frame']
                            })
                            scene_id += 1  # Increment for sub-scenes

                        current_time = end_time

                    filtered_scenes.extend(sub_scenes)

            logger.info(f"Detected {len(filtered_scenes)} scenes (filtered from {len(scenes)})")

            return filtered_scenes

        except Exception as e:
            logger.error(f"Error detecting scenes: {str(e)}")
            raise

    def save_scenes(self, scenes: List[Dict[str, Any]], output_path: str) -> None:
        """
        Save scenes to JSON file

        Args:
            scenes: List of scene dictionaries
            output_path: Path to save scenes
        """
        try:
            with open(output_path, 'w') as f:
                json.dump(scenes, f, indent=2)
            logger.info(f"Scenes saved to {output_path}")
        except Exception as e:
            logger.error(f"Error saving scenes: {str(e)}")
            raise

    def get_video_segments(
        self,
        video_path: str,
        scenes: List[Dict[str, Any]],
        output_dir: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract video segments based on scene boundaries

        Args:
            video_path: Path to video file
            scenes: List of scene dictionaries
            output_dir: Directory to save segments

        Returns:
            List of segment information
        """
        try:
            if output_dir is None:
                output_dir = os.path.join(os.path.dirname(video_path), "segments")
            os.makedirs(output_dir, exist_ok=True)

            base_name = os.path.splitext(os.path.basename(video_path))[0]
            segments = []

            for i, scene in enumerate(scenes):
                segment_id = f"{base_name}_scene_{scene['shot_id']:04d}"
                start_time = scene['start_time']
                end_time = scene['end_time']

                output_path = os.path.join(output_dir, f"{segment_id}.mp4")

                # Extract segment using ffmpeg
                try:
                    (
                        ffmpeg
                        .input(video_path, ss=start_time, t=end_time - start_time)
                        .output(output_path, vcodec='libx264', acodec='none')
                        .overwrite_output()
                        .run(quiet=True)
                    )

                    segment_info = {
                        'segment_id': segment_id,
                        'scene_id': scene['shot_id'],
                        'start_time': start_time,
                        'end_time': end_time,
                        'start_frame': scene['start_frame'],
                        'end_frame': scene['end_frame'],
                        'duration': end_time - start_time,
                        'file_path': output_path
                    }

                    segments.append(segment_info)

                except Exception as e:
                    logger.error(f"Error extracting segment {i}: {str(e)}")
                    continue

            logger.info(f"Extracted {len(segments)} video segments")
            return segments

        except Exception as e:
            logger.error(f"Error getting video segments: {str(e)}")
            raise

    def clear_model(self) -> None:
        """Clear model from memory"""
        if self.model is not None:
            del self.model
            self.model = None
            self.model_loaded = False

            # Clear GPU cache if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info("TransNetV2 model cleared from memory")


# Convenience function for quick scene detection
def detect_scenes_simple(
    video_path: str,
    threshold: float = 0.2,
    output_file: Optional[str] = None,
    min_scene_length: int = 15
) -> List[Dict[str, Any]]:
    """
    Simple function to detect scenes in a video

    Args:
        video_path: Path to video file
        threshold: Scene detection threshold
        output_file: Optional path to save scenes JSON
        min_scene_length: Minimum scene length in frames

    Returns:
        List of scene dictionaries
    """
    detector = TransNetV2SceneDetector()
    scenes = detector.detect_scenes(video_path, threshold, min_scene_length)

    if output_file:
        detector.save_scenes(scenes, output_file)

    return scenes


# Example usage
if __name__ == "__main__":
    # Example: Detect scenes in a video
    video_path = "/path/to/your/video.mp4"

    # Create detector
    detector = TransNetV2SceneDetector()

    # Detect scenes
    scenes = detector.detect_scenes(video_path, threshold=0.2)

    # Print results
    print(f"Found {len(scenes)} scenes:")
    for scene in scenes[:5]:  # Show first 5
        print(f"Scene {scene['shot_id']}: {scene['start_time']:.2f}s - {scene['end_time']:.2f}s")

    # Save to file
    output_file = video_path.replace('.mp4', '_scenes.json')
    detector.save_scenes(scenes, output_file)
    print(f"Scenes saved to {output_file}")