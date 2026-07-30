// Ganti dengan URL Worker Anda setelah deploy
const API_URL = 'https://your-worker.your-subdomain.workers.dev';

let currentVideoData = null;

async function fetchVideo() {
    const url = document.getElementById('urlInput').value.trim();
    
    if (!url) {
        showError('Masukkan URL YouTube terlebih dahulu');
        return;
    }

    if (!url.includes('youtube.com/watch') && !url.includes('youtu.be')) {
        showError('URL YouTube tidak valid');
        return;
    }

    showLoading(true);
    hideError();
    hideVideoInfo();

    try {
        const response = await fetch(`${API_URL}/info?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            throw new Error('Gagal mengambil informasi video');
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        currentVideoData = data;
        displayVideoInfo(data);
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function displayVideoInfo(data) {
    document.getElementById('videoInfo').style.display = 'block';
    document.getElementById('thumbnail').src = data.thumbnail;
    document.getElementById('duration').textContent = formatDuration(data.duration);
    document.getElementById('title').textContent = data.title;
    document.getElementById('channel').textContent = data.channel;
    document.getElementById('views').textContent = formatViews(data.views);
    document.getElementById('date').textContent = formatDate(data.uploadDate);

    displayFormats(data.formats);
}

function displayFormats(formats) {
    const videoFormats = formats.filter(f => f.hasVideo);
    const audioFormats = formats.filter(f => !f.hasVideo && f.hasAudio);

    displayFormatList('videoFormats', videoFormats, 'video');
    displayFormatList('audioFormats', audioFormats, 'audio');
}

function displayFormatList(containerId, formats, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (formats.length === 0) {
        container.innerHTML = '<p>Tidak ada format tersedia</p>';
        return;
    }

    // Hapus duplikat kualitas
    const uniqueFormats = [];
    const seen = new Set();

    formats.forEach(format => {
        const key = type === 'video' ? format.qualityLabel : format.audioBitrate;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueFormats.push(format);
        }
    });

    uniqueFormats.forEach(format => {
        const formatItem = document.createElement('div');
        formatItem.className = 'format-item';
        
        let infoText = '';
        if (type === 'video') {
            infoText = `${format.qualityLabel} - ${format.container}`;
            if (format.hasAudio) {
                infoText += ' (dengan audio)';
            } else {
                infoText += ' (video saja)';
            }
        } else {
            infoText = `MP3 - ${format.audioBitrate || 'Unknown'} kbps`;
        }

        const sizeText = format.fileSize ? formatFileSize(format.fileSize) : 'Ukuran tidak diketahui';

        formatItem.innerHTML = `
            <div>
                <strong>${infoText}</strong>
                <br>
                <small>${sizeText}</small>
            </div>
            <button class="download-btn" onclick="startDownload('${format.itag}', '${type}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;

        container.appendChild(formatItem);
    });
}

async function startDownload(itag, type) {
    const url = document.getElementById('urlInput').value.trim();
    const downloadUrl = `${API_URL}/download?url=${encodeURIComponent(url)}&itag=${itag}&type=${type}`;

    // Tampilkan progress
    document.getElementById('downloadProgress').style.display = 'block';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';

    try {
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            throw new Error('Gagal mendownload');
        }

        const contentLength = response.headers.get('Content-Length');
        const reader = response.body.getReader();
        const chunks = [];

        let receivedLength = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (contentLength) {
                const progress = (receivedLength / contentLength) * 100;
                updateProgress(progress);
            }
        }

        // Buat blob dan trigger download
        const blob = new Blob(chunks);
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        
        const videoTitle = currentVideoData ? currentVideoData.title : 'youtube-video';
        const extension = type === 'video' ? 'mp4' : 'mp3';
        a.download = `${videoTitle.replace(/[^\w\s]/gi, '')}.${extension}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        
        updateProgress(100);
    } catch (error) {
        showError('Gagal mendownload: ' + error.message);
    }
}

function switchFormat(type) {
    const buttons = document.querySelectorAll('.format-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById('videoFormats').style.display = type === 'video' ? 'flex' : 'none';
    document.getElementById('audioFormats').style.display = type === 'audio' ? 'flex' : 'none';
    
    event.target.classList.add('active');
}

function updateProgress(percent) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = Math.round(percent) + '%';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

function hideVideoInfo() {
    document.getElementById('videoInfo').style.display = 'none';
    document.getElementById('downloadProgress').style.display = 'none';
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views) {
    if (!views) return '';
    if (views >= 1000000) {
        return (views / 1000000).toFixed(1) + 'M views';
    }
    if (views >= 1000) {
        return (views / 1000).toFixed(1) + 'K views';
    }
    return views + ' views';
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < sizes.length - 1) {
        bytes /= 1024;
        i++;
    }
    return bytes.toFixed(1) + ' ' + sizes[i];
}

// Enter key support
document.getElementById('urlInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        fetchVideo();
    }
});