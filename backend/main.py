from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT_PATH = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

from game_engine import GameEngine, PlayerState

BACKEND_VERSION = "2.0.0"


class ChoiceOption(BaseModel):
    text: str
    hint: str


class ScoreDetail(BaseModel):
    strategy: int
    logic: int
    social: int
    role_consistency: int
    total: int
    comments: str


class StartGameRequest(BaseModel):
    name: str
    gender: str = "男"
    talents: Optional[List[str]] = None
    attributes: Optional[Dict[str, int]] = None


class StartGameResponse(BaseModel):
    game_id: str
    narrative: str
    scene_title: str
    scene_description: str
    choices: List[ChoiceOption]
    attribute_changes: Dict[str, int]
    score: Optional[ScoreDetail] = None
    new_age: int
    state: Dict[str, Any]


class ActionRequest(BaseModel):
    input: str


class ActionResponse(BaseModel):
    narrative: str
    scene_title: str
    scene_description: str
    choices: List[ChoiceOption]
    attribute_changes: Dict[str, int]
    score: Optional[ScoreDetail] = None
    new_age: int
    summary: Optional[Dict[str, str]] = None


app = FastAPI(title="浮生渡 API", version=BACKEND_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

games: Dict[str, GameEngine] = {}


def _serialize_player_state(state: PlayerState) -> Dict[str, Any]:
    return {
        "player_id": state.player_id,
        "name": state.name,
        "gender": state.gender,
        "age": state.age,
        "stage": state.stage,
        "attributes": state.attributes.as_dict(),
        "talents": state.talents,
        "traits": state.traits,
        "history": state.history,
        "flags": state.flags,
        "game_over": state.game_over,
    }


@app.post("/api/game/start", response_model=StartGameResponse)
def start_game(request: StartGameRequest) -> StartGameResponse:
    game_id = str(uuid.uuid4())
    engine = GameEngine()
    result = engine.start_game(
        name=request.name,
        gender=request.gender,
        talents=request.talents,
        initial_attributes=request.attributes,
    )
    games[game_id] = engine
    return StartGameResponse(
        game_id=game_id,
        narrative=result.narrative,
        scene_title=result.scene_title,
        scene_description=result.scene_description,
        choices=result.choices,
        attribute_changes=result.attribute_changes,
        score=result.score if result.score else None,
        new_age=result.new_age,
        state=_serialize_player_state(engine.state),
    )


@app.post("/api/game/{game_id}/action")
def perform_action(game_id: str, request: ActionRequest):
    engine = games.get(game_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="无效的 game_id")
    if engine.state and engine.state.game_over:
        raise HTTPException(status_code=400, detail="游戏已结束")

    result = engine.process_action(request.input)

    return {
        "narrative": result.narrative,
        "scene_title": result.scene_title,
        "scene_description": result.scene_description,
        "choices": result.choices,
        "attribute_changes": result.attribute_changes,
        "score": result.score,
        "new_age": result.new_age,
        "summary": result.summary,
        "state": _serialize_player_state(engine.state) if engine.state else None,
    }


@app.get("/api/game/{game_id}/state")
def get_game_state(game_id: str) -> Dict[str, Any]:
    engine = games.get(game_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="无效的 game_id")
    if not engine.state:
        raise HTTPException(status_code=400, detail="游戏未初始化")
    return _serialize_player_state(engine.state)


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/version")
def get_version() -> Dict[str, str]:
    return {"version": BACKEND_VERSION}
