import { useEffect, useState } from 'react';
export function MonthNotice({ month }: { month: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <div className="month-notice" role="status">
      <strong>现在是 {month} 月</strong>
      <span>新的一月开始，请准备出牌</span>
    </div>
  ) : null;
}
