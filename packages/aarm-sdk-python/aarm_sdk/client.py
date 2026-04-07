import logging
from typing import Optional

from .types import AarmConfig, RawRequest, MediationResult
from .transport import Transport, RestTransport, AsyncTransport, AsyncRestTransport

def _setup_logger(config: AarmConfig) -> logging.Logger:
    logger = logging.getLogger('aarm_sdk')
    if config.log_level is not None:
        logger.setLevel(config.log_level)
        if not logger.handlers:
            formatter = logging.Formatter('[%(levelname)s] AARM - %(message)s')
            if config.log_file:
                fh = logging.FileHandler(config.log_file)
                fh.setFormatter(formatter)
                logger.addHandler(fh)
            else:
                sh = logging.StreamHandler()
                sh.setFormatter(formatter)
                logger.addHandler(sh)
    else:
        logger.addHandler(logging.NullHandler())
    return logger

class AarmClient:
    def __init__(self, 
                 base_url: str, 
                 business_unit: Optional[str] = None, 
                 application: Optional[str] = None, 
                 principal_id: Optional[str] = None,
                 log_level: Optional[int] = None,
                 log_file: Optional[str] = None,
                 transport: Optional[Transport] = None):
        
        self.config = AarmConfig(
            base_url=base_url,
            business_unit=business_unit,
            application=application,
            principal_id=principal_id,
            log_level=log_level,
            log_file=log_file
        )
        self.logger = _setup_logger(self.config)
        self.transport = transport or RestTransport(self.config.base_url)
        self.logger.debug(f"AarmClient initialized with baseUrl: {self.config.base_url}")

    def mediate_action(self, request: RawRequest) -> MediationResult:
        """
        Mediate an action through the AARM platform.
        
        :param request: The action details to evaluate
        :return: The decision and optionally a verifiable receipt
        """
        # Fill in missing context from global config
        full_request = RawRequest(
            session_id=request.session_id,
            intent=request.intent,
            user_prompt=request.user_prompt,
            action_type=request.action_type,
            parameters=request.parameters,
            business_unit=request.business_unit or self.config.business_unit,
            application=request.application or self.config.application,
            principal_id=request.principal_id or self.config.principal_id
        )

        self.logger.debug(f"Mediating action: {request.action_type} with payload: {full_request}")
        try:
            result = self.transport.mediate(full_request)
            self.logger.debug(f"Mediation result for {request.action_type}: {result.status}")
            return result
        except Exception as e:
            self.logger.error(f"Transport failed during mediate_action: {e}")
            raise

class AsyncAarmClient:
    def __init__(self, 
                 base_url: str, 
                 business_unit: Optional[str] = None, 
                 application: Optional[str] = None, 
                 principal_id: Optional[str] = None,
                 log_level: Optional[int] = None,
                 log_file: Optional[str] = None,
                 transport: Optional[AsyncTransport] = None):
        
        self.config = AarmConfig(
            base_url=base_url,
            business_unit=business_unit,
            application=application,
            principal_id=principal_id,
            log_level=log_level,
            log_file=log_file
        )
        self.logger = _setup_logger(self.config)
        self.transport = transport or AsyncRestTransport(self.config.base_url)
        self.logger.debug(f"AsyncAarmClient initialized with baseUrl: {self.config.base_url}")

    async def mediate_action(self, request: RawRequest) -> MediationResult:
        full_request = RawRequest(
            session_id=request.session_id,
            intent=request.intent,
            user_prompt=request.user_prompt,
            action_type=request.action_type,
            parameters=request.parameters,
            business_unit=request.business_unit or self.config.business_unit,
            application=request.application or self.config.application,
            principal_id=request.principal_id or self.config.principal_id
        )

        self.logger.debug(f"Async Mediating action: {request.action_type} with payload: {full_request}")
        try:
            result = await self.transport.mediate(full_request)
            self.logger.debug(f"Async Mediation result for {request.action_type}: {result.status}")
            return result
        except Exception as e:
            self.logger.error(f"Async Transport failed during mediate_action: {e}")
            raise
