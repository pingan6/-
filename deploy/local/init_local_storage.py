"""Initialize original Jellyfish media access in the loopback-only local deployment."""

import json

from botocore.exceptions import ClientError

from app.config import settings
from app.core.storage import _build_s3_client, init_storage


def main():
    """Create the bucket and its initial media-read policy; preserve later custom policies.

    Upstream emits public thumbnail URLs. RustFS needs a bucket GetObject policy
    for those URLs; this grants no anonymous listing, writes or administrative access.
    This setup is for loopback-only local use, not a private/public production design.
    """
    init_storage()
    client = _build_s3_client()
    bucket = settings.s3_bucket_name
    try:
        client.get_bucket_policy(Bucket=bucket)
        print("Existing media policy preserved")
        return
    except ClientError as error:
        if error.response["Error"]["Code"] not in {"NoSuchBucketPolicy", "404"}:
            raise
    client.put_bucket_policy(Bucket=bucket, Policy=json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{bucket}/*",
        }],
    }))
    print("Local media storage initialized")


if __name__ == "__main__":
    main()
