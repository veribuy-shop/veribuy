import httpx
import logging
from typing import Optional
from app.config import settings
from app.schemas.verification import IMEICheckResult

logger = logging.getLogger(__name__)


def _stub_imei_result(imei: str) -> IMEICheckResult:
    """
    Deterministic stub response used when no valid API key is configured.
    IMEIs ending in an even digit → valid/clean.
    IMEIs ending in an odd digit → invalid (IMEI_MISMATCH flag will be set by router).
    This lets the full verification flow run end-to-end without a live API key.
    """
    last_digit = int(imei[-1])
    valid = last_digit % 2 == 0
    logger.warning(
        "IMEI Check running in STUB MODE (no valid IMEI_CHECK_API_KEY). "
        "Set IMEI_CHECK_API_KEY in .env to use the live API."
    )
    return IMEICheckResult(
        imei=imei,
        valid=valid,
        device_model="Stub Device Model" if valid else None,
        carrier="Stub Carrier" if valid else None,
        blacklisted=False,
        reported_stolen=False,
    )


class IMEICheckService:
    def __init__(self):
        self.api_url = settings.imei_check_api_url
        self.api_key = settings.imei_check_api_key

    async def check_imei(self, imei: str) -> IMEICheckResult:
        """Check IMEI against imeicheck.com API, or return a stub when unconfigured."""
        if settings.imei_stub_mode:
            return _stub_imei_result(imei)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v1/checks",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"imei": imei, "service": "basic"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                return IMEICheckResult(
                    imei=imei,
                    valid=data.get("valid", False),
                    device_model=data.get("model"),
                    carrier=data.get("carrier"),
                    blacklisted=data.get("blacklisted", False),
                    reported_stolen=data.get("stolen", False),
                )
        except httpx.HTTPError:
            return IMEICheckResult(
                imei=imei,
                valid=False,
                blacklisted=False,
                reported_stolen=False,
            )


imei_check_service = IMEICheckService()
