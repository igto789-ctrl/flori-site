// Кто владелец CRM. Роль хранится в app_metadata: её может менять только сервер (service_role),
// сам пользователь — нет (в отличие от user_metadata). Чистая функция: её используют middleware, API и server actions.
type MaybeUser = { app_metadata?: Record<string, unknown> | null } | null | undefined;

export const OWNER_ROLE = "owner";

export function isOwner<T extends MaybeUser>(user: T): user is NonNullable<T> {
  return user?.app_metadata?.role === OWNER_ROLE;
}
