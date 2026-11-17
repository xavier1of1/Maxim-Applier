export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const notFound = () => new DomainError('not_found', 'Record not found.', 404);
export function invariant(value: unknown, code: string, message: string, status = 400): asserts value {
  if (!value) throw new DomainError(code, message, status);
}
