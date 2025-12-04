import type { StreamCallbackMessage } from '@xsky/ai-agent-core';
import type { ElectronAPI } from '../preload/preload';

// Globals
const api = window.electronAPI;
let currentTaskId: string | null = null;
let isPaused = false;

// DOM Elements
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
const messagesList = document.getElementById('messages-list') as HTMLDivElement;
const sendBtn = document.getElementById('btn-send') as HTMLButtonElement;
const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const taskStatus = document.getElementById('task-status') as HTMLDivElement;

// Navigation Buttons
document.getElementById('btn-back')?.addEventListener('click', () => api.view.goBack());
document.getElementById('btn-forward')?.addEventListener('click', () => api.view.goForward());
document.getElementById('btn-refresh')?.addEventListener('click', () => api.view.refresh());
document.getElementById('btn-screenshot')?.addEventListener('click', async () => {
    try {
        const dataUrl = await api.view.screenshot();
        addMessage('system', 'Screenshot captured', dataUrl);
    } catch (err) {
        console.error('Screenshot failed:', err);
    }
});

// URL Bar
urlInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (url) {
            const finalUrl = await api.view.navigate(url);
            urlInput.value = finalUrl;
        }
    }
});

// Chat Input
sendBtn.addEventListener('click', submitTask);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitTask();
    }
});

async function submitTask() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // UI Updates
    chatInput.value = '';
    addMessage('user', prompt);
    updateStatus('running');
    sendBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;

    try {
        await api.eko.runTask(prompt);
        // Note: Task completion is handled via streaming events
    } catch (error) {
        console.error('Task failed:', error);
        addMessage('error', error instanceof Error ? error.message : String(error));
        updateStatus('error');
    }
}

// Task Controls
pauseBtn.addEventListener('click', async () => {
    if (!currentTaskId) return;
    await api.eko.pauseTask(currentTaskId);
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? '▶️' : '⏸️';
    updateStatus(isPaused ? 'paused' : 'running');
});

stopBtn.addEventListener('click', async () => {
    if (!currentTaskId) return;
    await api.eko.abortTask(currentTaskId);
    updateStatus('idle');
});

// Stream Event Handling
api.eko.onTaskEvent((event: StreamCallbackMessage) => {
    console.log('Task event:', event);

    if (event.type === 'workflow') {
        if (event.workflow && event.workflow.taskId) {
            currentTaskId = event.workflow.taskId;
        }
    } else if (event.type === 'agent_start') {
        // addMessage('system', `Agent ${event.agentName} started...`);
    } else if (event.type === 'text') {
        // Only show final text chunks or accumulate them
        // For simplicity, we just log them
    } else if (event.type === 'tool_use') {
        addMessage('agent', `Using tool: ${event.toolName}`);
    } else if (event.type === 'agent_result') {
        if (event.result) {
            addMessage('agent', event.result);
        }
    } else if (event.type === 'error') {
        addMessage('error', String(event.error));
        updateStatus('error');
    } else if (event.type === 'finish') {
        updateStatus('idle');
        addMessage('system', 'Task completed');
    }
});

// Helpers
function addMessage(role: 'user' | 'agent' | 'system' | 'error', text: string, imageUrl?: string) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    msgDiv.appendChild(contentDiv);

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'message-image';
        msgDiv.appendChild(img);
    }

    messagesList.appendChild(msgDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

function updateStatus(status: 'idle' | 'running' | 'paused' | 'error') {
    taskStatus.className = `status-${status}`;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    if (status === 'idle' || status === 'error') {
        sendBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        currentTaskId = null;
        isPaused = false;
        pauseBtn.textContent = '⏸️';
    }
}
