// Горната лента: име, начин на връзка, закъснение, рамки в секунда, батерия, часовник.
import { setText, setClass, fmt, makeBatteryIcon } from './util.js';

const MODE = {
  demo: ['Демо', 'mode-demo'],
  lan: ['У дома', 'mode-lan'],
  webrtc: ['Отвън', 'mode-rtc'],
};

export function init(root) {
  root.innerHTML = `
    <div class="tb-brand">
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <rect x="2" y="3" width="28" height="22" rx="8" fill="#e8eef6"/>
        <rect x="5" y="7" width="22" height="13" rx="5" fill="#0b121b"/>
        <circle cx="11.5" cy="13.5" r="3.2" fill="#3cc8ff"/><circle cx="20.5" cy="13.5" r="3.2" fill="#3cc8ff"/>
        <rect x="8" y="26" width="5" height="4" rx="1.5" fill="#6b7d93"/><rect x="19" y="26" width="5" height="4" rx="1.5" fill="#6b7d93"/>
      </svg>
      <span class="tb-name">Робот</span>
    </div>
    <span class="badge mode-demo" id="tbMode">Демо</span>
    <span class="tb-link"><i class="dot" id="tbDot"></i><span id="tbConn">няма връзка</span></span>
    <span class="tb-chip hide-s"><span class="k">закъснение</span> <b class="num" id="tbRtt">—</b> ms</span>
    <span class="tb-chip hide-s"><span class="k">рамки</span> <b class="num" id="tbRx">—</b> /s</span>
    <span class="tb-spacer"></span>
    <span class="tb-bat"><span class="tb-bat-ic"></span><b class="num" id="tbPct">—</b></span>
    <span class="tb-clock num" id="tbClock">--:--:--</span>`;
  const mode = root.querySelector('#tbMode'), dot = root.querySelector('#tbDot'), conn = root.querySelector('#tbConn');
  const rtt = root.querySelector('#tbRtt'), rx = root.querySelector('#tbRx');
  const pct = root.querySelector('#tbPct'), clock = root.querySelector('#tbClock');
  const icon = makeBatteryIcon(root.querySelector('.tb-bat-ic'), { w: 30, h: 14 });
  let lastSec = -1;

  return {
    update(ctx) {
      const s = ctx.state, l = s.link;
      icon.update(s.battery.pct);
      if (!ctx.slow) return;
      const md = MODE[l.mode] || [l.mode, 'mode-demo'];
      setText(mode, md[0]); setClass(mode, 'badge ' + md[1]);
      setClass(dot, 'dot ' + (l.connected ? 'ok' : 'off'));
      setText(conn, l.connected ? 'на линия' : 'няма връзка');
      setText(rtt, l.rtt_ms == null ? '—' : fmt(l.rtt_ms, 0));
      setText(rx, fmt(l.rx_hz, 0));
      setText(pct, s.battery.pct == null ? '—' : Math.round(s.battery.pct) + '%');
      const d = new Date(), sec = d.getSeconds();
      if (sec !== lastSec) {
        lastSec = sec;
        setText(clock, String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(sec).padStart(2, '0'));
      }
    },
  };
}
