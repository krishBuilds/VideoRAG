"""
Integration of TransNetV2 scene detection with VideoRAG
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from .transnetv2_scene import TransNetV2SceneDetector
from .._utils import logger

class VideoSceneDetector:
    """
    Integrates scene detection into VideoRAG workflow
    """

    def __init__(self, working_dir: str):
        self.working_dir = working_dir
        self.detector = TransNetV2SceneDetector()

    def detect_and_save_scenes(
        self,
        video_path: str,
        video_name: str,
        threshold: float = 0.2,
        min_scene_length: int = 15,
        min_duration_sec: float = 5.0,
        max_duration_sec: float = 12.0
    ) -> List[Dict[str, Any]]:
        """
        Detect scenes in video and save results

        Args:
            video_path: Path to video file
            video_name: Name of the video
            threshold: Scene detection threshold
            min_scene_length: Minimum scene length in frames

        Returns:
            List of scene dictionaries
        """
        try:
            logger.info(f"Detecting scenes for {video_name}")

            # Detect scenes using TransNetV2
            scenes = self.detector.detect_scenes(
                video_path,
                threshold=threshold,
                min_scene_length=min_scene_length,
                min_duration_sec=min_duration_sec,
                max_duration_sec=max_duration_sec
            )

            # Save scenes to file
            scenes_file = os.path.join(self.working_dir, f"{video_name}_scenes.json")
            with open(scenes_file, 'w') as f:
                json.dump(scenes, f, indent=2)

            logger.info(f"Detected {len(scenes)} scenes in {video_name}")
            logger.info(f"Scenes saved to {scenes_file}")

            return scenes

        except Exception as e:
            logger.error(f"Error detecting scenes for {video_name}: {str(e)}")
            return []

    def load_scenes(self, video_name: str) -> List[Dict[str, Any]]:
        """
        Load previously detected scenes

        Args:
            video_name: Name of the video

        Returns:
            List of scene dictionaries
        """
        try:
            scenes_file = os.path.join(self.working_dir, f"{video_name}_scenes.json")

            if not os.path.exists(scenes_file):
                return []

            with open(scenes_file, 'r') as f:
                scenes = json.load(f)

            logger.info(f"Loaded {len(scenes)} scenes for {video_name}")
            return scenes

        except Exception as e:
            logger.error(f"Error loading scenes for {video_name}: {str(e)}")
            return []

    def extract_video_segments(
        self,
        video_path: str,
        video_name: str,
        scenes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Extract video segments based on scenes

        Args:
            video_path: Path to video file
            video_name: Name of the video
            scenes: List of scene dictionaries

        Returns:
            Dictionary with segment information
        """
        try:
            logger.info(f"Extracting segments for {video_name}")

            # Create segments directory
            segments_dir = os.path.join(self.working_dir, "segments", video_name)
            os.makedirs(segments_dir, exist_ok=True)

            # Extract segments
            segments = self.detector.get_video_segments(
                video_path,
                scenes,
                segments_dir
            )

            # Create segment mapping
            segment_index2name = {}
            segment_times_info = {}

            for i, segment in enumerate(segments):
                segment_id = str(i)
                segment_index2name[segment_id] = segment['segment_id']
                segment_times_info[segment_id] = {
                    'frame_times': [],  # Will be filled by video splitting logic
                    'timestamp': (segment['start_time'], segment['end_time']),
                    'scene_id': segment['scene_id']
                }

            logger.info(f"Extracted {len(segments)} segments for {video_name}")

            return {
                'segment_index2name': segment_index2name,
                'segment_times_info': segment_times_info,
                'segments': segments
            }

        except Exception as e:
            logger.error(f"Error extracting segments for {video_name}: {str(e)}")
            return {
                'segment_index2name': {},
                'segment_times_info': {},
                'segments': []
            }