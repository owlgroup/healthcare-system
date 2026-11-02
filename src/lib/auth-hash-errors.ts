const AUTH_ERROR_VI: Record<string, string> = {
  otp_expired:
    "Link xác nhận đã hết hạn. Nhờ Quản trị viên gửi lại email thiết lập mật khẩu hoặc dùng chức năng «Đặt lại mật khẩu» trên trang quản trị.",
  access_denied: "Không thể xác thực link. Link có thể đã hết hạn hoặc đã được sử dụng.",
  invalid_request: "Yêu cầu xác thực không hợp lệ. Vui lòng mở lại link mới nhất trong email.",
  user_not_found: "Không tìm thấy tài khoản. Liên hệ Quản trị viên để được tạo lại.",
};

const DESCRIPTION_VI: Record<string, string> = {
  "email link is invalid or has expired":
    "Link email không hợp lệ hoặc đã hết hạn. Nhờ Quản trị viên gửi lại email thiết lập mật khẩu.",
};

function decodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** Parse Supabase auth errors from URL hash (#error=...) or query (?error=...). */
export function parseAuthUrlError(
  hash: string,
  search: string,
): string | null {
  const hashParams = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(hashParams || search);

  const errorCode = params.get("error_code") ?? params.get("error");
  const description = decodeParam(params.get("error_description"));

  if (description) {
    const key = description.trim().toLowerCase();
    if (DESCRIPTION_VI[key]) return DESCRIPTION_VI[key];
  }

  if (errorCode && AUTH_ERROR_VI[errorCode]) {
    return AUTH_ERROR_VI[errorCode];
  }

  if (params.get("error") === "access_denied") {
    return AUTH_ERROR_VI.access_denied;
  }

  if (description) {
    return description;
  }

  return null;
}

export function hasAuthCallbackParams(hash: string, search: string): boolean {
  const hashParams = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(hashParams || search);
  return (
    params.has("access_token") ||
    params.has("code") ||
    params.has("error") ||
    params.has("error_code") ||
    params.get("type") === "recovery" ||
    params.get("type") === "invite" ||
    params.get("type") === "signup"
  );
}
