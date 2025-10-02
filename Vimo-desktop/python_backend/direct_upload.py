"""
Direct file upload endpoint to add to videorag_api.py
Add this code to videorag_api.py after the existing upload endpoint
"""

from werkzeug.utils import secure_filename
import uuid

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Add this route to videorag_api.py
@app.route('/api/upload/video', methods=['POST'])
def direct_upload_video():
    """Direct file upload endpoint for frontend"""
    log_to_file(f"📝 API: Direct file upload request")

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
                'error': 'Invalid file type. Allowed: mp4, avi, mov, mkv, wmv, flv, webm'
            }), 400

        # Generate unique filename
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        save_filename = f"{unique_id}_{filename}"
        save_path = os.path.join(UPLOAD_FOLDER, save_filename)

        # Save file
        file.save(save_path)
        log_to_file(f"📁 File saved: {save_path}")

        # Get configuration
        config_json = request.form.get('config', '{}')
        config = json.loads(config_json) if config_json else {}

        # Create job
        job_id = str(uuid.uuid4())

        # Store job info (in production, use Redis/database)
        jobs = getattr(direct_upload_video, '_jobs', {})
        jobs[job_id] = {
            'file_path': save_path,
            'original_filename': filename,
            'config': config,
            'status': 'uploaded',
            'created_at': time.time()
        }
        direct_upload_video._jobs = jobs

        log_to_file(f"✅ File uploaded successfully: {filename} -> {save_path}, job_id: {job_id}")

        return jsonify({
            'success': True,
            'file_id': unique_id,
            'job_id': job_id,
            'message': 'Video uploaded successfully',
            'file_path': save_path
        })

    except Exception as e:
        log_to_file(f"❌ Upload error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Upload failed: {str(e)}'
        }), 500

@app.route('/api/upload/status/<job_id>', methods=['GET'])
def get_upload_status(job_id):
    """Get upload job status"""
    jobs = getattr(direct_upload_video, '_jobs', {})

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
        'file_path': job['file_path'],
        'message': f"Job status: {job['status']}"
    })

@app.route('/api/upload/process/<job_id>', methods=['POST'])
def process_uploaded_video(job_id):
    """Process uploaded video"""
    jobs = getattr(direct_upload_video, '_jobs', {})

    if job_id not in jobs:
        return jsonify({
            'success': False,
            'error': 'Job not found'
        }), 404

    job = jobs[job_id]

    # Start processing in background
    # You can call the existing processing logic here
    job['status'] = 'processing'
    log_to_file(f"🔄 Started processing job: {job_id}")

    return jsonify({
        'success': True,
        'message': 'Processing started',
        'job_id': job_id
    })