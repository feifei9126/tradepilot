export type LoginResult = { ok?: boolean; error?: string | null; code?: string | null } | undefined;

export function isSuccessfulLogin(result: LoginResult): boolean {
  return result?.ok === true && !result.error;
}

export function loginFailureMessage(result: LoginResult): string {
  if (result?.error === "CredentialsSignin" && result.code === "service_unavailable") {
    return "登录服务暂时不可用，请稍后重试或联系管理员";
  }
  if (result?.error === "CredentialsSignin") {
    return "登录失败，请检查邮箱和密码";
  }
  return "登录服务暂时不可用，请稍后重试";
}
