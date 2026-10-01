// قناة بسيطة لطلب تسجيل الخروج من أي مكان في الواجهة (بدل متغير عام على window)
let handler = null;
export const onLogoutRequest = (fn) => {
  handler = fn;
  return () => handler === fn && (handler = null);
};
export const requestLogout = () => handler?.();
