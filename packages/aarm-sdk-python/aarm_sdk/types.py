from dataclasses import dataclass, field
from typing import Optional, Dict, Any

@dataclass
class RawRequest:
    session_id: str
    intent: str
    user_prompt: str
    action_type: str
    business_unit: Optional[str] = None
    application: Optional[str] = None
    principal_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

@dataclass
class ApprovalResponse:
    status: str
    extra_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MediationResult:
    status: str
    execution_status: str
    receipt: Optional[Dict[str, Any]] = None

@dataclass
class AarmConfig:
    base_url: str
    business_unit: Optional[str] = None
    application: Optional[str] = None
    principal_id: Optional[str] = None
    log_level: Optional[int] = None
    log_file: Optional[str] = None
