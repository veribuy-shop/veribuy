import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas.verification import VerificationRequest, VerificationResponse
from app.services.imei_check import imei_check_service
from app.services.icloud_check import icloud_check_service
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

router = APIRouter()
tracer = trace.get_tracer(__name__)


@router.post("/verify", response_model=VerificationResponse)
async def verify_device(request: VerificationRequest):
    """Run IMEI and iCloud verification checks on a device."""
    with tracer.start_as_current_span("deviceVerification.verify") as span:
        span.set_attribute("listing.id", request.listing_id)
        if request.imei:
            span.set_attribute("device.imei", request.imei)
        if request.serial_number:
            span.set_attribute("device.serialNumber", request.serial_number)

        try:
            if not request.imei and not request.serial_number:
                span.set_status(Status(StatusCode.ERROR, "Missing IMEI or serial number"))
                raise HTTPException(status_code=400, detail="Either IMEI or serial number is required")

            flags: list[str] = []
            imei_valid = False
            icloud_locked = False
            reported_stolen = False
            blacklisted = False
            carrier = None
            device_model = None

            if request.imei:
                with tracer.start_as_current_span("deviceVerification.checkIMEI") as imei_span:
                    imei_span.set_attribute("imei", request.imei)
                    imei_result = await imei_check_service.check_imei(request.imei)
                    imei_valid = imei_result.valid
                    carrier = imei_result.carrier
                    device_model = imei_result.device_model
                    blacklisted = imei_result.blacklisted
                    reported_stolen = imei_result.reported_stolen

                    imei_span.set_attribute("imei.valid", imei_valid)
                    imei_span.set_attribute("imei.blacklisted", blacklisted)
                    imei_span.set_attribute("imei.reportedStolen", reported_stolen)
                    if carrier:
                        imei_span.set_attribute("device.carrier", carrier)
                    if device_model:
                        imei_span.set_attribute("device.model", device_model)

                    if not imei_valid:
                        flags.append("IMEI_MISMATCH")
                    if blacklisted:
                        flags.append("BLACKLISTED")
                    if reported_stolen:
                        flags.append("REPORTED_STOLEN")

            if request.imei or request.serial_number:
                with tracer.start_as_current_span("deviceVerification.checkiCloud") as icloud_span:
                    if request.imei:
                        icloud_span.set_attribute("imei", request.imei)
                    if request.serial_number:
                        icloud_span.set_attribute("serialNumber", request.serial_number)
                    
                    icloud_result = await icloud_check_service.check_icloud(
                        imei=request.imei,
                        serial_number=request.serial_number,
                    )
                    icloud_locked = icloud_result.icloud_locked

                    icloud_span.set_attribute("icloud.locked", icloud_locked)

                    if icloud_locked:
                        flags.append("ICLOUD_LOCKED")

            if not flags:
                flags.append("CLEAN")

            span.set_attribute("verification.flags", ",".join(flags))
            span.set_attribute("verification.flagCount", len(flags))
            span.set_attribute("verification.clean", "CLEAN" in flags)
            span.set_status(Status(StatusCode.OK))

            return VerificationResponse(
                verification_id=str(uuid.uuid4()),
                listing_id=request.listing_id,
                imei=request.imei,
                serial_number=request.serial_number,
                imei_valid=imei_valid,
                icloud_locked=icloud_locked,
                reported_stolen=reported_stolen,
                blacklisted=blacklisted,
                carrier=carrier,
                device_model=device_model,
                verified_at=datetime.now(timezone.utc),
                flags=flags,
            )
        except HTTPException:
            raise
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise

