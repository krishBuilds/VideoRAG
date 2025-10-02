"""
Additional API endpoints for Electron frontend communication
"""

from flask import request, jsonify
import os
import logging
from videorag_api import app
from videorag._utils.model_config import get_model_config
from videorag._videoutil.transnetv2_scene import TransNetV2SceneDetector

logger = logging.getLogger(__name__)

# Model management endpoints
@app.route('/api/models/setup', methods=['POST'])
def setup_models():
    """Setup and download all required models"""
    try:
        data = request.get_json() or {}
        models_dir = data.get('models_dir', None)

        # Setup model configuration
        model_config = get_model_config(models_dir)
        model_info = model_config.get_all_model_info()

        return jsonify({
            'success': True,
            'message': 'Model setup completed',
            'model_info': model_info
        })
    except Exception as e:
        logger.error(f"Error setting up models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/info', methods=['GET'])
def get_models_info():
    """Get information about downloaded models"""
    try:
        model_config = get_model_config()
        model_info = model_config.get_all_model_info()

        return jsonify({
            'success': True,
            'model_info': model_info
        })
    except Exception as e:
        logger.error(f"Error getting model info: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Scene detection endpoint
@app.route('/api/scene-detection', methods=['POST'])
def detect_scenes_api():
    """Detect scenes in a video using TransNetV2"""
    try:
        data = request.get_json()
        video_path = data.get('video_path')
        threshold = data.get('threshold', 0.2)
        min_duration = data.get('min_duration', 5.0)
        max_duration = data.get('max_duration', 12.0)

        if not video_path or not os.path.exists(video_path):
            return jsonify({
                'success': False,
                'error': 'Video file not found'
            }), 400

        # Initialize scene detector
        detector = TransNetV2SceneDetector()

        # Detect scenes
        scenes = detector.detect_scenes(
            video_path,
            threshold=threshold,
            min_duration_sec=min_duration,
            max_duration_sec=max_duration
        )

        return jsonify({
            'success': True,
            'scenes': scenes,
            'total_scenes': len(scenes)
        })
    except Exception as e:
        logger.error(f"Error in scene detection: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Configuration endpoint
@app.route('/api/config/update', methods=['POST'])
def update_config():
    """Update VideoRAG configuration from Electron"""
    try:
        config = request.get_json()

        # Store configuration for later use
        config_file = os.path.join(os.getcwd(), 'electron_config.json')
        import json
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)

        logger.info(f"Configuration updated from Electron: {config.keys()}")

        return jsonify({
            'success': True,
            'message': 'Configuration updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating config: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/config/get', methods=['GET'])
def get_config():
    """Get current configuration"""
    try:
        config_file = os.path.join(os.getcwd(), 'electron_config.json')

        if os.path.exists(config_file):
            import json
            with open(config_file, 'r') as f:
                config = json.load(f)
            return jsonify({
                'success': True,
                'config': config
            })
        else:
            return jsonify({
                'success': True,
                'config': {}
            })
    except Exception as e:
        logger.error(f"Error getting config: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Progress tracking
@app.route('/api/progress/set', methods=['POST'])
def set_progress():
    """Set progress for a task (Electron can poll this)"""
    try:
        data = request.get_json()
        task_id = data.get('task_id')
        progress = data.get('progress')
        message = data.get('message')

        # Store progress in a simple file
        progress_file = os.path.join(os.getcwd(), f'progress_{task_id}.json')
        import json
        with open(progress_file, 'w') as f:
            json.dump({
                'task_id': task_id,
                'progress': progress,
                'message': message,
                'timestamp': str(os.path.getmtime(progress_file))
            }, f)

        return jsonify({
            'success': True
        })
    except Exception as e:
        logger.error(f"Error setting progress: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/progress/get/<task_id>', methods=['GET'])
def get_progress(task_id):
    """Get progress for a task"""
    try:
        progress_file = os.path.join(os.getcwd(), f'progress_{task_id}.json')

        if os.path.exists(progress_file):
            import json
            with open(progress_file, 'r') as f:
                progress_data = json.load(f)
            return jsonify({
                'success': True,
                'progress': progress_data
            })
        else:
            return jsonify({
                'success': True,
                'progress': {'progress': 0, 'message': 'Not started'}
            })
    except Exception as e:
        logger.error(f"Error getting progress: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500