"""
Upload API endpoints for RunPod video processing
Handles video uploads with 1 FPS processing and scene detection
"""

import os
import json
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import request, jsonify
from videorag_api import app
from videorag import VideoRAG, QueryParam
import logging

logger = logging.getLogger(__name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
PROCESSED_FOLDER = os.path.join(os.getcwd(), 'processed')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# Allowed video extensions
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'}

# Job storage (in production, use Redis or database)
jobs = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload/video', methods=['POST'])
def upload_video():
    """Upload video file for processing"""
    try:
        # Check if video file is present
        if 'video' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No video file provided'
            }), 400

        file = request.files['video']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': f'Invalid file type. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        # Get configuration from form
        config_json = request.form.get('config', '{}')
        config = json.loads(config_json)

        # Ensure 1 FPS processing
        config['target_fps'] = 1
        config['enable_scene_detection'] = config.get('detect_scenes', True)
        config['scene_detection_threshold'] = config.get('scene_threshold', 0.2)
        config['scene_segment_min_duration'] = config.get('min_duration', 5.0)
        config['scene_segment_max_duration'] = config.get('max_duration', 12.0)
        config['enable_audio_processing'] = False  # Disable audio

        # Generate unique job ID
        job_id = str(uuid.uuid4())

        # Save uploaded file
        filename = secure_filename(file.filename)
        file_id = f"{job_id}_{filename}"
        video_path = os.path.join(UPLOAD_FOLDER, file_id)
        file.save(video_path)

        # Create job record
        jobs[job_id] = {
            'job_id': job_id,
            'file_id': file_id,
            'filename': filename,
            'video_path': video_path,
            'status': 'uploaded',
            'config': config,
            'created_at': datetime.now().isoformat(),
            'progress': 0,
            'message': 'Video uploaded successfully'
        }

        logger.info(f"Video uploaded: {filename}, Job ID: {job_id}")

        return jsonify({
            'success': True,
            'file_id': file_id,
            'job_id': job_id,
            'message': 'Video uploaded successfully'
        })

    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/jobs/<job_id>/process', methods=['POST'])
def process_video(job_id):
    """Start processing uploaded video"""
    try:
        if job_id not in jobs:
            return jsonify({
                'success': False,
                'error': 'Job not found'
            }), 404

        job = jobs[job_id]

        if job['status'] != 'uploaded':
            return jsonify({
                'success': False,
                'error': f'Cannot process job in status: {job["status"]}'
            }), 400

        # Update job status
        job['status'] = 'processing'
        job['progress'] = 0.1
        job['message'] = 'Starting video processing...'

        # Start processing in background thread
        import threading
        thread = threading.Thread(target=process_video_background, args=(job_id,))
        thread.daemon = True
        thread.start()

        return jsonify({
            'success': True,
            'message': 'Processing started',
            'job_id': job_id
        })

    except Exception as e:
        logger.error(f"Process error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def process_video_background(job_id):
    """Background video processing"""
    try:
        job = jobs[job_id]
        video_path = job['video_path']
        config = job['config']

        # Create processing directory
        process_dir = os.path.join(PROCESSED_FOLDER, job_id)
        os.makedirs(process_dir, exist_ok=True)

        # Initialize VideoRAG with optimized configuration
        videorag = VideoRAG(
            input_dir=process_dir,
            output_dir=process_dir,
            target_fps=config['target_fps'],  # 1 FPS
            enable_scene_detection=config['enable_scene_detection'],
            scene_detection_threshold=config['scene_detection_threshold'],
            scene_segment_min_duration=config['scene_segment_min_duration'],
            scene_segment_max_duration=config['scene_segment_max_duration'],
            enable_audio_processing=config['enable_audio_processing'],
            openai_api_key=None,  # Not needed for indexing
            embedding_model=None
        )

        # Update progress
        job['progress'] = 0.2
        job['message'] = 'Initializing VideoRAG...'

        # Index the video
        videorag.index()

        # Save VideoRAG instance for later querying
        job['videorag'] = videorag
        job['status'] = 'completed'
        job['progress'] = 1.0
        job['message'] = 'Processing completed successfully'
        job['completed_at'] = datetime.now().isoformat()

        logger.info(f"Processing completed for job: {job_id}")

    except Exception as e:
        logger.error(f"Processing error for job {job_id}: {str(e)}")
        job['status'] = 'failed'
        job['message'] = f'Processing failed: {str(e)}'
        job['error'] = str(e)

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get job status"""
    try:
        if job_id not in jobs:
            return jsonify({
                'success': False,
                'error': 'Job not found'
            }), 404

        job = jobs[job_id]

        return jsonify({
            'success': True,
            'job_id': job_id,
            'status': job['status'],
            'progress': job.get('progress', 0),
            'message': job.get('message', ''),
            'filename': job['filename'],
            'created_at': job['created_at'],
            'completed_at': job.get('completed_at'),
            'error': job.get('error')
        })

    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/jobs/<job_id>/query', methods=['POST'])
def query_video(job_id):
    """Query processed video"""
    try:
        if job_id not in jobs:
            return jsonify({
                'success': False,
                'error': 'Job not found'
            }), 404

        job = jobs[job_id]

        if job['status'] != 'completed':
            return jsonify({
                'success': False,
                'error': 'Job not completed yet'
            }), 400

        if 'videorag' not in job:
            return jsonify({
                'success': False,
                'error': 'VideoRAG instance not available'
            }), 400

        query_data = request.get_json()
        query_text = query_data.get('query', '')

        if not query_text:
            return jsonify({
                'success': False,
                'error': 'Query text is required'
            }), 400

        # Perform query
        videorag = job['videorag']
        results = videorag.query(query_text)

        return jsonify({
            'success': True,
            'results': results
        })

    except Exception as e:
        logger.error(f"Query error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    """List all jobs"""
    try:
        job_list = []
        for job_id, job in jobs.items():
            job_list.append({
                'job_id': job_id,
                'filename': job['filename'],
                'status': job['status'],
                'created_at': job['created_at'],
                'progress': job.get('progress', 0)
            })

        return jsonify({
            'success': True,
            'jobs': job_list
        })

    except Exception as e:
        logger.error(f"List jobs error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500