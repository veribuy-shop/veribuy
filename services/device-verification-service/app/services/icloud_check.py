import httpx
import logging
from app.config import settings
from app.schemas.verification import ICloudCheckResult

logger = logging.getLogger(__name__)


def _stub_icloud_result(imei: str | None, serial_number: str | None) -> ICloudCheckResult:
    """
    Deterministic stub response used when no valid API key is configured.
    Always returns icloud_locked=False so the flow proceeds cleanly.
    """
    logger.warning(
        "iCloud Check running in STUB MODE (no valid IFREE_ICLOUD_API_KEY). "
        "Set IFREE_ICLOUD_API_KEY in .env to use the live API."
    )
    return ICloudCheckResult(
        serial_number=serial_number,
        imei=imei,
        icloud_locked=False,
        find_my_enabled=False,
    )


class ICloudCheckService:
    def __init__(self):
        self.api_url = settings.ifree_icloud_api_url
        self.api_key = settings.ifree_icloud_api_key

    async def check_icloud(self, imei: str | None = None, serial_number: str | None = None) -> ICloudCheckResult:
        """Check iCloud lock status via ifreeicloud.com API, or return a stub when unconfigured."""
        if settings.icloud_stub_mode:
            return _stub_icloud_result(imei, serial_number)

        try:
            payload = {}
            if imei:
                payload["imei"] = imei
            if serial_number:
                payload["serial"] = serial_number

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/api/check",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                return ICloudCheckResult(
                    serial_number=serial_number,
                    imei=imei,
                    icloud_locked=data.get("icloud_locked", False),
                    find_my_enabled=data.get("find_my_enabled"),
                )
        except httpx.HTTPError:
            return ICloudCheckResult(
                serial_number=serial_number,
                imei=imei,
                icloud_locked=False,
            )


icloud_check_service = ICloudCheckService()
