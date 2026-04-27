export const canCompleteLocationResolutionLease = (
	existing: { leaseOwner?: string } | null,
	leaseOwner: string,
) => existing === null || existing.leaseOwner === leaseOwner;
