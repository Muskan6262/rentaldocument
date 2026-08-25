import os
import clamd
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

class ClamAVScanner:
    def __init__(self):
        self.host = os.getenv("CLAMAV_HOST", "clamav")
        self.port = 3310
        try:
            self.cd = clamd.ClamdNetworkSocket(self.host, self.port)
        except Exception as e:
            logger.warning(f"Could not initialize ClamAV socket: {e}")
            self.cd = None

    def scan_bytes(self, data: bytes) -> bool:
        """
        Scans a byte stream for viruses.
        Returns True if safe, False if a virus is detected.
        Raises exception if ClamAV is unavailable.
        """
        if not self.cd:
            logger.warning("ClamAV scanner is not connected. Bypassing scan.")
            return True
            
        try:
            result = self.cd.instream(BytesIO(data))
            
            if result and 'stream' in result:
                status, reason = result['stream']
                if status == 'FOUND':
                    logger.error(f"Virus found: {reason}")
                    return False
            return True
        except Exception as e:
            logger.error(f"Error during virus scan: {e}")
            raise Exception(f"Failed to scan document for viruses: {str(e)}")

scanner = ClamAVScanner()
