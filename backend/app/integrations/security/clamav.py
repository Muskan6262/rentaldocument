import os
import clamd
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

class ClamAVScanner:
    def __init__(self):
        self.host = os.getenv("CLAMAV_HOST", "clamav")
        self.port = int(os.getenv("CLAMAV_PORT", "3310"))
        self.enabled = os.getenv("CLAMAV_ENABLED", "true").lower() in ("true", "1", "yes")
        self.strict_mode = os.getenv("CLAMAV_STRICT_MODE", "false").lower() in ("true", "1", "yes")
        try:
            self.cd = clamd.ClamdNetworkSocket(self.host, self.port)
        except Exception as e:
            logger.warning(f"Could not initialize ClamAV socket: {e}")
            self.cd = None

    def scan_bytes(self, data: bytes) -> bool:
        """
        Scans a byte stream for viruses.
        Returns True if safe, False if a virus is detected.
        If ClamAV is unreachable:
          - in strict mode: raises an Exception
          - in non-strict mode: logs a warning and allows processing to continue
        """
        if not self.enabled:
            logger.info("ClamAV scanning is disabled via CLAMAV_ENABLED. Bypassing scan.")
            return True

        if not self.cd:
            logger.warning("ClamAV scanner is not initialized. Bypassing scan.")
            return True
            
        try:
            result = self.cd.instream(BytesIO(data))
            
            if result and 'stream' in result:
                status, reason = result['stream']
                if status == 'FOUND':
                    logger.error(f"Virus found in document: {reason}")
                    return False
            return True
        except Exception as e:
            logger.warning(f"ClamAV daemon unavailable or connection failed ({e}).")
            if self.strict_mode:
                raise Exception(f"Failed to scan document for viruses: {str(e)}")
            logger.warning("Proceeding with upload in degraded mode (ClamAV bypass).")
            return True

scanner = ClamAVScanner()

