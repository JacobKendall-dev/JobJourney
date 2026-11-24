/**
 * Limits and switches for features that spend the app owner's DeepSpace
 * credits. Change a number here to raise or lower a daily cap, or set a
 * feature to false to stop it spending anything. Both features keep working
 * without their paid call: sharing skips the Claude check, the digest skips
 * the email.
 */

/** Claude privacy check when a post is shared or edited. */
export const PRIVACY_CHECK_ENABLED = true
/** Checks per day for the whole app (UTC day). */
export const PRIVACY_CHECKS_PER_DAY = 50
/** Checks per person per day (UTC day). */
export const PRIVACY_CHECKS_PER_USER_DAY = 10
/** The cheapest Claude model. The endpoint defaults to Opus, so always pass this. */
export const PRIVACY_MODEL = 'claude-haiku-4-5'
/** Caps the reply length, which caps the cost of each check. */
export const PRIVACY_MAX_TOKENS = 300

/** Daily email to authors who opted in, listing posts with new comments. */
export const DIGEST_ENABLED = true
/** Emails sent per daily run, at most. */
export const DIGEST_EMAILS_PER_RUN = 10
