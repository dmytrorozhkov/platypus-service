# CloudFront account verification request — draft only

Status: prepared November 5, 2026; not submitted. The learner owns account verification and any Support correspondence. Do not send this draft automatically or put passwords, tokens or identity documents in the repository/chat.

Open https://console.aws.amazon.com/support/home#/ and create an account-verification/account-and-billing case in the existing account. Use the available account-support route; do not purchase a support plan or upgrade the account merely to open this request. If the available choices differ, inspect them before selecting a paid option.

Subject: CloudFront account verification required for a learning project

Hello AWS Support,

I am building Platypus Service, a small learning application in my existing AWS project. The project is on an active Free plan. CloudFormation successfully created the private S3 storage and the Node.js Lambda backend in eu-north-1, but CloudFront distribution creation was rejected on November 5, 2026 at approximately 08:45 UTC with this message:

Your account must be verified before you can add new CloudFront resources. To verify your account, please contact AWS Support (https://console.aws.amazon.com/support/home#/) and include this error message.

Service: CloudFront. HTTP status: 403.
Request ID: 8f04599e-636f-45ab-bd05-a1e9ec30b416.

Could you please verify this account for CloudFront use, or explain the required verification steps? I would like to keep the existing Free plan and do not want to activate paid or advanced account features. This is a fictional-data learning demo using a private S3 origin and an IAM-protected Lambda Function URL, without a custom domain or production data.

Thank you.

## Resume after verification

Keep the Support reply/reference outside public project history. Once AWS confirms the restriction is lifted, refresh identity, Free plan/credits, quotas and current resource inventory. Preserve the existing S3 and backend stacks and their ZIP. The failed edge stack is ROLLBACK_COMPLETE and cannot simply be updated: review and explicitly authorize removal/recreation of that empty owned stack, or another concrete recovery, before acting. Do not recreate all three stacks or overwrite immutable package keys. Then continue the disabled-edge bootstrap, new full release with the actual generated HTTPS origin, backend origin/version update, storage grant, ordered uploads and edge enablement from infrastructure/README.md. Public browser acceptance is still required.
