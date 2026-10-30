// Joystick -> left/right thruster power. x: right positive, y: DOWN positive (screen coordinates).
export function mixJoystick(x, y, deadzone = 0.1) {
  const len = Math.hypot(x, y);
  if (len < deadzone) return { left: 0, right: 0 };
  const mag = (Math.min(len, 1) - deadzone) / (1 - deadzone);   // 0 at the dead zone edge, 1 at full throw
  const throttle = -(y / len) * mag;                            // push up = forward
  const steer = (x / len) * mag;                                // push right = turn right
  const l = throttle + steer;
  const r = throttle - steer;
  const m = Math.max(1, Math.abs(l), Math.abs(r));              // keep both inside -1..1
  return { left: l / m, right: r / m };
}
