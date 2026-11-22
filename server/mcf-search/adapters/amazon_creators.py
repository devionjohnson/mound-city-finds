"""Amazon Creators API (successor to the retired PA-API 5) - DISABLED STUB.
Access requires the Associates account to meet Amazon's eligibility (qualifying sales) and Creators API registration
(Associates Central > Tools > Creators API > Create Application > Create Credential).
Env: CREATORS_CREDENTIAL_ID, CREATORS_SECRET, CREATORS_VERSION; partner tag printsquad-20 (CREATORS_PARTNER_TAG).
Docs: https://affiliate-program.amazon.com/creatorsapi/docs/
Kept disabled: the site never shows Amazon prices, and Amazon items already come from the site's own index."""
NAME = "amazon_creators"
REQUIRED_ENV = ["CREATORS_CREDENTIAL_ID", "CREATORS_SECRET", "CREATORS_VERSION"]
ENABLE_FLAG = "CREATORS_ENABLED"


def enabled(env):
    return False  # stub: not implemented until Creators API access exists


def search(query, env, timeout=4, limit=20):
    return []
