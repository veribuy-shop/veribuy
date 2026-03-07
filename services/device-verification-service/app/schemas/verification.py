from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional


class VerificationRequest(BaseModel):
    imei: Optional[str] = Field(None, min_length=15, max_length=15, pattern=r"^\d{15}$")
    serial_number: Optional[str] = Field(None, min_length=1)
    listing_id: str


class IMEICheckResult(BaseModel):
    imei: str
    valid: bool
    device_model: Optional[str] = None
    carrier: Optional[str] = None
    blacklisted: bool = False
    reported_stolen: bool = False


class ICloudCheckResult(BaseModel):
    serial_number: Optional[str] = None
    imei: Optional[str] = None
    icloud_locked: bool = False
    find_my_enabled: Optional[bool] = None


class VerificationResponse(BaseModel):
    verification_id: str
    listing_id: str
    imei: Optional[str] = None
    serial_number: Optional[str] = None
    imei_valid: bool = False
    icloud_locked: bool = False
    reported_stolen: bool = False
    blacklisted: bool = False
    carrier: Optional[str] = None
    device_model: Optional[str] = None
    verified_at: datetime
    flags: list[str] = []
