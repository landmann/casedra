export const COPY_REVIEWER_EMAILS = [
	"nlandmanc@gmail.com",
	"debbielandman77@gmail.com",
	"debbielandman88@gmail.com",
] as const;

const copyReviewerEmails = new Set<string>(COPY_REVIEWER_EMAILS);

export const normalizeCopyReviewEmail = (emailAddress?: string | null) =>
	emailAddress?.trim().toLowerCase() ?? null;

export const canUseCopyReview = (emailAddress?: string | null) => {
	const normalizedEmailAddress = normalizeCopyReviewEmail(emailAddress);

	return Boolean(
		normalizedEmailAddress && copyReviewerEmails.has(normalizedEmailAddress),
	);
};
