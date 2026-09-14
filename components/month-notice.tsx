import { useEffect, useState } from 'react';
import { environmentNames, type Environment } from '../lib/game/engine';
export function MonthNotice({
  month,
  environment = 'normal',
  armageddon = false,
}: {
  month: number;
  environment?: Environment;
  armageddon?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <div className="month-notice" role="status">
      <strong>
        现在是 {month} 月 ·{' '}
        {armageddon ? '善恶决战' : environmentNames[environment]}
      </strong>
      <span>新的一月开始，请准备出牌</span>
    </div>
  ) : null;
}
