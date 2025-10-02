"""
Model configuration and download management
Ensures all models are stored in a dedicated models directory
"""

import os
import logging
import torch
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class ModelConfig:
    """Centralized model configuration and download management"""

    def __init__(self, base_dir: Optional[str] = None):
        """
        Initialize model configuration

        Args:
            base_dir: Base directory for models. If None, uses ./models
        """
        if base_dir is None:
            # Default to a 'models' directory in the backend root
            self.base_dir = Path(__file__).parent.parent.parent.parent / "models"
        else:
            self.base_dir = Path(base_dir)

        self.base_dir.mkdir(exist_ok=True)
        logger.info(f"Model directory set to: {self.base_dir}")

    def get_model_path(self, model_name: str) -> Path:
        """Get full path for a model file"""
        return self.base_dir / model_name

    # ImageBind configuration
    def get_imagebind_model_path(self, model_variant: str = "huge") -> Path:
        """Get ImageBind model path"""
        return self.get_model_path(f"imagebind_{model_variant}.pth")

    def ensure_imagebind_model(self, model_variant: str = "huge") -> Path:
        """
        Ensure ImageBind model is available

        Returns:
            Path to the ImageBind model
        """
        model_path = self.get_imagebind_model_path(model_variant)

        if model_path.exists():
            logger.info(f"ImageBind model already exists at {model_path}")
            return model_path

        logger.info(f"Downloading ImageBind {model_variant} model...")

        try:
            from imagebind.models.imagebind_model import imagebind_huge, imagebind_base

            # Load the model which will trigger download
            if model_variant == "huge":
                model = imagebind_huge(pretrained=True)
            else:
                model = imagebind_base(pretrained=True)

            # Save the model to our location
            torch.save(model.state_dict(), model_path)
            logger.info(f"ImageBind model saved to {model_path}")

            return model_path

        except Exception as e:
            logger.error(f"Failed to download ImageBind model: {str(e)}")
            raise

    # TransNetV2 configuration
    def get_transnetv2_model_path(self) -> Path:
        """Get TransNetV2 model path"""
        return self.get_model_path("transnetv2-pytorch-weights.pth")

    def ensure_transnetv2_model(self) -> Path:
        """
        Ensure TransNetV2 model is available

        Returns:
            Path to the TransNetV2 model
        """
        model_path = self.get_transnetv2_model_path()

        if model_path.exists():
            logger.info(f"TransNetV2 model already exists at {model_path}")
            return model_path

        logger.info(f"Downloading TransNetV2 model...")

        try:
            import requests

            url = "https://huggingface.co/MiaoshouAI/transnetv2-pytorch-weights/resolve/main/transnetv2-pytorch-weights.pth"

            response = requests.get(url, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0

            with open(model_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            logger.info(f"Downloading TransNetV2: {progress:.1f}%")

            logger.info(f"TransNetV2 model saved to {model_path}")
            return model_path

        except Exception as e:
            logger.error(f"Failed to download TransNetV2 model: {str(e)}")
            raise

    # MiniCPM-V configuration (for captioning)
    def get_minicpm_model_path(self, model_name: str = "MiniCPM-V-2_6-int4") -> Path:
        """Get MiniCPM-V model path"""
        return self.base_dir / model_name

    def ensure_minicpm_model(self, model_name: str = "MiniCPM-V-2_6-int4") -> Path:
        """
        Ensure MiniCPM-V model is available

        Returns:
            Path to the MiniCPM-V model directory
        """
        model_path = self.get_minicpm_model_path(model_name)

        if model_path.exists():
            logger.info(f"MiniCPM-V model already exists at {model_path}")
            return model_path

        logger.info(f"Cloning MiniCPM-V model from HuggingFace...")

        try:
            from git import Repo

            repo_url = f"https://huggingface.co/openbmb/{model_name}"
            Repo.clone_from(repo_url, model_path)

            logger.info(f"MiniCPM-V model cloned to {model_path}")
            return model_path

        except Exception as e:
            logger.error(f"Failed to clone MiniCPM-V model: {str(e)}")
            raise

    # Whisper model configuration (if needed in future)
    def get_whisper_model_path(self, model_name: str = "base") -> Path:
        """Get Whisper model path"""
        return self.get_model_path(f"whisper_{model_name}.pt")

    def get_all_model_info(self) -> Dict[str, Any]:
        """Get information about all models"""
        info = {
            "model_directory": str(self.base_dir),
            "models": {}
        }

        # Check ImageBind
        for variant in ["huge", "base"]:
            path = self.get_imagebind_model_path(variant)
            info["models"][f"imagebind_{variant}"] = {
                "path": str(path),
                "exists": path.exists(),
                "size": path.stat().st_size if path.exists() else 0
            }

        # Check TransNetV2
        path = self.get_transnetv2_model_path()
        info["models"]["transnetv2"] = {
            "path": str(path),
            "exists": path.exists(),
            "size": path.stat().st_size if path.exists() else 0
        }

        # Check MiniCPM-V
        path = self.get_minicpm_model_path()
        info["models"]["minicpm_v"] = {
            "path": str(path),
            "exists": path.exists(),
            "size": sum(f.stat().st_size for f in path.rglob('*') if f.is_file()) if path.exists() else 0
        }

        return info


# Global model configuration instance
_model_config = None

def get_model_config(base_dir: Optional[str] = None) -> ModelConfig:
    """Get or create model configuration instance"""
    global _model_config
    if _model_config is None:
        _model_config = ModelConfig(base_dir)
    return _model_config


def setup_model_directory(base_dir: Optional[str] = None) -> ModelConfig:
    """
    Setup model directory and ensure all required models

    Args:
        base_dir: Base directory for models

    Returns:
        ModelConfig instance
    """
    config = get_model_config(base_dir)

    logger.info("Setting up models directory...")

    # Ensure ImageBind model
    try:
        config.ensure_imagebind_model("huge")
    except Exception as e:
        logger.warning(f"Failed to download ImageBind model: {e}")

    # Ensure TransNetV2 model
    try:
        config.ensure_transnetv2_model()
    except Exception as e:
        logger.warning(f"Failed to download TransNetV2 model: {e}")

    # Ensure MiniCPM-V model (optional, can be large)
    try:
        config.ensure_minicpm_model()
    except Exception as e:
        logger.warning(f"Failed to download MiniCPM-V model: {e}")

    # Log model info
    info = config.get_all_model_info()
    logger.info(f"Model setup complete. Directory: {info['model_directory']}")

    return config