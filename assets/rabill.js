/* contractor-bill.niveshsahayak.in: running account (RA) bill for contractors. BOQ items with previous, this-bill and cumulative
   quantities and amounts, works-contract GST on this bill, and the usual deductions (retention / security deposit, income-tax TDS,
   GST TDS for government clients, advance recovery). Record type 'rabill'; this bill's value is a sale in the Nivesh Sahayak App.
   "Next RA bill" moves this bill's quantities into "previous" for the next one. */
(function () {
  'use strict';
  var $ = NS.$, esc = NS.esc, num = NS.num, r2 = NS.r2, t = NS.t;
  function row() { return { item: '', desc: '', unit: 'Cum', rate: '', boq: '', prev: '', qty: '' }; }
  function sums(d) {
    var o = { rows: [], prevAmt: 0, gross: 0, cumAmt: 0, boqAmt: 0, over: 0 };
    d.boqs.forEach(function (b) {
      if (!b.desc && !num(b.rate)) return;
      var r = num(b.rate), p = num(b.prev), q = num(b.qty), c = r2(p + q);
      var x = { b: b, cum: c, pa: r2(p * r), ta: r2(q * r), ca: r2(c * r), ba: r2(num(b.boq) * r), pct: num(b.boq) ? Math.round(c / num(b.boq) * 1000) / 10 : 0 };
      if (num(b.boq) && c > num(b.boq) + 1e-9) o.over++;
      o.rows.push(x); o.prevAmt += x.pa; o.gross += x.ta; o.cumAmt += x.ca; o.boqAmt += x.ba;
    });
    ['prevAmt', 'gross', 'cumAmt', 'boqAmt'].forEach(function (k) { o[k] = r2(o[k]); });
    o.g = d.gst === 'other' ? num(d.gstOther) : num(d.gst);
    o.tax = r2(o.gross * o.g / 100);
    o.intra = !d.buyer.state || !d.seller.state || d.buyer.state === d.seller.state;
    if (o.intra) { o.cgst = r2(o.tax / 2); o.sgst = r2(o.tax - o.cgst); o.igst = 0; } else { o.igst = o.tax; o.cgst = o.sgst = 0; }
    o.billVal = r2(o.gross + o.tax);
    o.ret = r2(o.gross * num(d.retPct) / 100);
    o.tds = r2(o.gross * num(d.tdsPct) / 100);   /* income-tax TDS on the value without GST */
    o.gtds = d.gtds ? r2(o.gross * 2 / 100) : 0; /* GST TDS 2% (1% CGST + 1% SGST, or 2% IGST) on the taxable value */
    o.adv = r2(num(d.advRec)); o.mat = r2(num(d.matRec)); o.oth = r2(num(d.othDed));
    o.ded = r2(o.ret + o.tds + o.gtds + o.adv + o.mat + o.oth);
    o.net = r2(o.billVal - o.ded);
    o.total = o.billVal;
    return o;
  }

  NS.kit({
    type: 'rabill', prefix: 'RA', digits: 3, paper: 'a4', papers: ['a4'], party: 'customer',
    name: function (d) { return d.final ? 'Final Bill' : 'RA Bill ' + (d.raNo || ''); },
    blank: function () { return { raNo: '1', final: false, work: '', wo: '', woDate: '', site: '', from: '', to: NS.today(), gst: '18', gstOther: '', retPct: '5', tdsPct: '', gtds: false, advRec: '', matRec: '', othDed: '', othNote: '', boqs: [row()] }; },
    newRow: function () { return row(); },
    form: function (K) {
      return K.card(t('ra.client'), '<div class="fg">' + K.f('buyer.name', t('ra.cname'), { wide: true }) + K.f('buyer.addr', t('l.addr'), { type: 'textarea', wide: true }) +
          K.f('buyer.state', t('l.state'), { type: 'select', opts: K.states() }) + K.f('buyer.gstin', t('l.cgstin'), { max: 15, ltr: 1 }) + '</div>') +
        K.card(t('ra.work'), '<div class="fg">' + K.f('work', t('ra.wname'), { wide: true }) + K.f('site', t('ra.site')) + K.f('wo', t('ra.wo'), { ltr: 1 }) + K.f('woDate', t('ra.wodate'), { type: 'date' }) + '</div>') +
        K.numCard(K.f('raNo', t('ra.rano'), { mode: 'numeric', ltr: 1 }) + K.f('final', t('ra.final'), { type: 'check' }) + K.f('from', t('ra.from'), { type: 'date' }) + K.f('to', t('ra.to'), { type: 'date' })) +
        K.card(t('ra.boq'), K.list('boqs', t('ra.additem')) + '<div class="sums" id="ed-sums" aria-live="polite"></div>') +
        K.card(t('ra.taxded'), '<div class="fg">' +
          K.f('gst', t('ra.gst'), { type: 'select', opts: [['18', '18%'], ['other', t('ra.gother')], ['0', t('ra.gnone')]], hint: t('ra.gsth') }) + K.f('gstOther', t('ra.grate'), { mode: 'decimal', ltr: 1, show: 'gst=other' }) +
          K.f('retPct', t('ra.ret'), { mode: 'decimal', ltr: 1 }) + K.f('tdsPct', t('ra.tds'), { mode: 'decimal', ltr: 1, hint: t('ra.tdsh') }) +
          K.f('gtds', t('ra.gtds'), { type: 'check', hint: t('ra.gtdsh') }) +
          K.f('advRec', t('ra.adv'), { mode: 'decimal', ltr: 1 }) + K.f('matRec', t('ra.mat'), { mode: 'decimal', ltr: 1 }) + K.f('othDed', t('ra.oth'), { mode: 'decimal', ltr: 1 }) + K.f('othNote', t('ra.othnote')) + '</div>') +
        K.bizCard({ lg: t('ra.contractor') }) + K.lookCard();
    },
    rows: {
      boqs: function (b, i, K) {
        var c = r2(num(b.prev) + num(b.qty)), over = num(b.boq) && c > num(b.boq);
        return K.rf('boqs', i, 'item', t('ra.ino'), { ltr: 1 }) + K.rf('boqs', i, 'desc', t('l.desc'), { cls: 'it-d', sug: 'item' }) + K.rf('boqs', i, 'unit', t('l.unit'), { list: 'dl-ra-units', ltr: 1 }) +
          K.rf('boqs', i, 'rate', t('l.rate'), { mode: 'decimal', ltr: 1 }) + K.rf('boqs', i, 'boq', t('ra.boqqty'), { mode: 'decimal', ltr: 1 }) +
          K.rf('boqs', i, 'prev', t('ra.prev'), { mode: 'decimal', ltr: 1 }) + K.rf('boqs', i, 'qty', t('ra.this'), { mode: 'decimal', ltr: 1 }) +
          '<p class="hint wide' + (over ? ' warn' : '') + '">' + esc(t('ra.cum', { q: NS.qty(c), u: b.unit || '' })) + (over ? ' · ' + esc(t('ra.overq')) : '') + '</p>' +
          (i ? '' : '<datalist id="dl-ra-units"><option value="Cum"><option value="Sqm"><option value="Rmt"><option value="Nos"><option value="Kg"><option value="MT"><option value="Sqft"><option value="Rft"><option value="LS"><option value="Job"></datalist>');
      }
    },
    rowInput: function (n, i, k, d, el, K) { if (k === 'prev' || k === 'qty' || k === 'boq') { var p = el.closest('.it').querySelector('.hint'); if (p) { var b = d.boqs[i], c = r2(num(b.prev) + num(b.qty)), over = num(b.boq) && c > num(b.boq); p.className = 'hint wide' + (over ? ' warn' : ''); p.textContent = t('ra.cum', { q: NS.qty(c), u: b.unit || '' }) + (over ? ' · ' + t('ra.overq') : ''); } } },
    pickItem: function (b, m) { b.desc = m.desc; if (m.unit) b.unit = m.unit; if (m.rate !== '' && m.rate != null) b.rate = m.rate; },
    sums: sums,
    edSums: function (d, o) {
      return '<span>' + esc(t('ra.s.this', { v: NS.money(o.gross) })) + '</span><span>' + esc(t('ra.s.cum', { v: NS.money(o.cumAmt) })) + '</span>' + (o.boqAmt ? '<span>' + esc(t('ra.s.done', { p: Math.round(o.cumAmt / o.boqAmt * 1000) / 10 })) + '</span>' : '') +
        (o.tax ? '<span>' + esc(t('sum.gst', { v: NS.money(o.tax) })) + '</span>' : '') + '<span>' + esc(t('ra.s.ded', { v: NS.money(o.ded) })) + '</span><b>' + esc(t('ra.s.net', { v: NS.money(o.net) })) + '</b>' +
        (o.over ? '<span class="warn">' + esc(t('ra.s.over', { n: o.over })) + '</span>' : '');
    },
    validate: function (d, o) {
      var p = [];
      if (!String(d.buyer.name || '').trim()) p.push(['k-buyer-name', t('ra.v.client')]);
      if (!o.rows.length) p.push(['r-boqs-desc-0', t('v.item')]);
      if (!(o.gross > 0)) p.push(['r-boqs-qty-0', t('ra.v.qty')]);
      if (o.g && !d.seller.gstin) p.push(['k-seller-gstin', t('v.tax')]);
      return p;
    },
    confirm: function (d, o) { return o.over ? t('ra.c.over', { n: o.over }) : ''; },
    masterItems: function (d) { return d.boqs.filter(function (b) { return b.desc; }).map(function (b) { return { desc: String(b.desc).trim(), unit: b.unit || '', rate: b.rate, hsn: '9954', kind: 'service' }; }); },
    record: function (rec, o) {
      rec.kind = o.g ? 'tax' : 'plain'; rec.withGst = !!o.g; rec.status = 'unpaid'; rec.net = o.net; rec.ded = o.ded;
      rec.items = rec.boqs.filter(function (b) { return num(b.qty) && num(b.rate); }).map(function (b) { return { desc: (b.item ? b.item + ' ' : '') + b.desc, hsn: '9954', qty: b.qty, unit: b.unit, rate: b.rate, disc: '', gst: o.g }; });
    },
    copyOf: function (d) {
      d.boqs.forEach(function (b) { b.prev = String(r2(num(b.prev) + num(b.qty))); b.qty = ''; });
      d.raNo = String((+d.raNo || 0) + 1); d.from = d.to || ''; d.to = NS.today(); d.advRec = ''; d.matRec = ''; d.othDed = ''; d.othNote = ''; d.final = false;
    },
    copyLbl: 'ra.next',
    histName: function (d) { return (d.final ? 'Final' : 'RA ' + (d.raNo || '')) + ' · ' + (d.work || '') + ' · ' + (d.buyer && d.buyer.name || ''); },
    histText: function (d) { return [d.work, d.wo, d.site].join(' '); },
    histPill: function (d) { return ' <span class="pill">' + esc(t('ra.s.net', { v: NS.money(num(d.net)) })) + '</span>'; },
    upiShare: false,
    shareText: function (d, o) { return '\nWork: ' + (d.work || '') + '\nNet payable: ' + NS.money(o.net); },
    sheet: function (d, o, K) {
      var b = d.buyer, title = d.final ? 'FINAL BILL' : 'RUNNING ACCOUNT BILL No. ' + esc(d.raNo || '');
      var meta = [['Bill No.', '<span class="mono">' + esc(d.no) + '</span>'], ['Date', NS.fmtDate(d.date)], ['Name of work', esc(d.work)], d.site ? ['Site', esc(d.site)] : null,
        d.wo ? ['Work order / agreement', esc(d.wo) + (d.woDate ? ' dated ' + NS.fmtDate(d.woDate) : '')] : null, ['Work done', (d.from ? NS.fmtDate(d.from) + ' to ' : 'up to ') + NS.fmtDate(d.to)]];
      var m = function (v) { return v ? NS.money(v, false) : ''; }, q = function (v) { return num(v) ? NS.qty(num(v)) : ''; };
      var tbl = '<table class="lines ra"><thead><tr><th rowspan="2">Item</th><th rowspan="2" class="l">Description</th><th rowspan="2">Unit</th><th rowspan="2" class="n">Rate</th><th rowspan="2" class="n">BOQ qty</th><th colspan="3">Quantity</th><th colspan="3">Amount (₹)</th></tr>' +
        '<tr><th class="n">Previous</th><th class="n">This bill</th><th class="n">Up to date</th><th class="n">Previous</th><th class="n">This bill</th><th class="n">Up to date</th></tr></thead><tbody>' +
        o.rows.map(function (r) { return '<tr><td>' + esc(r.b.item) + '</td><td class="l">' + esc(r.b.desc) + '</td><td>' + esc(r.b.unit) + '</td><td class="n">' + m(num(r.b.rate)) + '</td><td class="n">' + q(r.b.boq) + '</td><td class="n">' + q(r.b.prev) + '</td><td class="n">' + q(r.b.qty) + '</td><td class="n">' + q(r.cum) + (num(r.b.boq) && r.cum > num(r.b.boq) ? ' *' : '') + '</td><td class="n">' + m(r.pa) + '</td><td class="n">' + m(r.ta) + '</td><td class="n">' + m(r.ca) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><th colspan="8" class="l">Total</th><th class="n">' + m(o.prevAmt) + '</th><th class="n">' + m(o.gross) + '</th><th class="n">' + m(o.cumAmt) + '</th></tr></tfoot></table>';
      var tot = K.tot([['Value of work this bill', NS.money(o.gross)], o.cgst ? ['CGST ' + o.g / 2 + '%', NS.money(o.cgst)] : null, o.sgst ? ['SGST ' + o.g / 2 + '%', NS.money(o.sgst)] : null, o.igst ? ['IGST ' + o.g + '%', NS.money(o.igst)] : null,
        ['Bill amount', NS.money(o.billVal), 'grand'], o.ret ? ['Less: retention / security deposit ' + num(d.retPct) + '%', '−' + NS.money(o.ret)] : null, o.tds ? ['Less: income-tax TDS ' + num(d.tdsPct) + '%', '−' + NS.money(o.tds)] : null,
        o.gtds ? ['Less: GST TDS 2%', '−' + NS.money(o.gtds)] : null, o.adv ? ['Less: advance recovered', '−' + NS.money(o.adv)] : null, o.mat ? ['Less: material recovered', '−' + NS.money(o.mat)] : null,
        o.oth ? ['Less: ' + (d.othNote ? esc(d.othNote) : 'other deductions'), '−' + NS.money(o.oth)] : null, ['Net payable', NS.money(o.net), 'grand']]);
      return K.open(d, 'rabill') + K.head(d, title, '') + K.meta(meta) + '<div class="parties">' + K.party(b, 'Client') + '</div>' + tbl +
        '<div class="foot"><div class="foot-l"><p class="words"><span>Net payable in words:</span> <b>' + NS.inWords(Math.max(0, o.net)) + '</b></p>' +
          '<p class="small">Works contract service, SAC 9954.' + (o.g ? ' GST ' + o.g + '% on the value of work in this bill.' : '') + (o.over ? ' * Quantity up to date exceeds the BOQ quantity.' : '') + '</p>' +
          (o.boqAmt ? '<p class="small">Work done up to date: ' + NS.money(o.cumAmt) + ' of BOQ ' + NS.money(o.boqAmt) + ' (' + Math.round(o.cumAmt / o.boqAmt * 1000) / 10 + '%).</p>' : '') +
          (d.notes ? '<p class="small">' + esc(d.notes).replace(/\n/g, '<br>') + '</p>' : '') + '</div><div class="foot-r">' + tot + '</div></div>' +
        '<div class="signs">' + K.blankSign('Measured and checked by', 'Engineer-in-charge') + K.sign(d, '', 'Contractor') + '</div>' + K.made() + '</div>';
    }
  });
})();
