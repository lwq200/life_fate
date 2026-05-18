import {
  StartGameRequest,
  StartGameResponse,
  ActionRequest,
  ActionResponse,
  PlayerState,
} from '@/types/game';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function startGame(
  request: StartGameRequest
): Promise<StartGameResponse> {
  const response = await fetch(`${API_BASE_URL}/api/game/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function sendAction(
  gameId: string,
  request: ActionRequest
): Promise<ActionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/game/${gameId}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getGameState(gameId: string): Promise<PlayerState> {
  const response = await fetch(`${API_BASE_URL}/api/game/${gameId}/state`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
}
