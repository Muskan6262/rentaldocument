import re

class PIIMasker:
    """
    Utility class to mask Personally Identifiable Information (PII) from text.
    Uses regex patterns to identify and redact sensitive data like Aadhaar cards,
    PAN cards, Phone numbers, and Email addresses.
    """
    
    # Regex Patterns
    AADHAAR_PATTERN = re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b')
    PAN_PATTERN = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b')
    PHONE_PATTERN = re.compile(r'\b(?:\+?91[\-\s]?)?[6789]\d{9}\b')
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', re.IGNORECASE)

    @classmethod
    def mask_text(cls, text: str) -> str:
        """
        Masks all identified PII in the given text.
        """
        if not text:
            return text
            
        masked_text = text
        
        # Mask Emails First (as they might contain numbers)
        masked_text = cls.EMAIL_PATTERN.sub('[MASKED_EMAIL]', masked_text)
        
        # Mask PAN
        masked_text = cls.PAN_PATTERN.sub('[MASKED_PAN]', masked_text)
        
        # Mask Aadhaar
        masked_text = cls.AADHAAR_PATTERN.sub('[MASKED_AADHAAR]', masked_text)
        
        # Mask Phone Numbers
        masked_text = cls.PHONE_PATTERN.sub('[MASKED_PHONE]', masked_text)
        
        return masked_text

pii_masker = PIIMasker()
