"""本番の地図生成と地方ボタンを使い、城・峠・海路・陸路を画素単位で検査する。"""
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright
from uifix import open_page


def inspect_map(page):
    return page.evaluate("""() => {
      const {E,MAP,R,DATA,GEO} = SG, {land,idx,MW,RS,masks} = R.M, pos = MAP.POS;
      const pixel = ([x,y]) => Math.floor(y*RS)*MW + Math.floor(x*RS);
      const castles = DATA.PROV.filter((p,i) => idx[pixel(pos[i])] !== i).map(p => p.id);
      // 細い半島と対岸の色が混ざると、城や経路の検査だけでは見逃す。
      const shores = [
        ['sagami',35.23,139.68], ['boshu',34.97,139.88], ['kazusa',35.18,140.31],
        ['noto',37.13,136.98], ['nanbu',41.34,140.92], ['tsugaru',41.11,140.45],
        ['bungo',33.56,131.59], ['nishihizen',32.72,130.28], ['osumi',31.12,130.79],
        ['izu',34.78,138.91], ['suo',34.18,131.75], ['iwami',34.91,132.19],
        ['hida',36.16,137.26], ['kai',35.28,138.46], ['osumi',31.81,130.56],
      ].filter(([id,lat,lon]) => idx[pixel(MAP.proj(lat,lon))] !== E.PI[id]);
      // 三国境・岬・湾岸の旧飛び地から、同じ国の画素を上下左右にたどって城へ戻れるか。
      const detached = [
        ['harima',34.90,135.12], ['hoki',35.4797,133.3214], ['satsuma',31.7352,130.6705],
      ].filter(([id,lat,lon]) => {
        const p = E.PI[id], start = pixel(MAP.proj(lat,lon)), castle = pixel(pos[p]);
        if (idx[start] !== p) return true;
        const seen = new Set([start]), pending = [start];
        while (pending.length) {
          const n = pending.pop();
          if (n === castle) return false;
          const x = n % MW, neighbors = [n-MW,n+MW];
          if (x > 0) neighbors.push(n-1);
          if (x+1 < MW) neighbors.push(n+1);
          for (const next of neighbors) {
            if (idx[next] !== p || seen.has(next)) continue;
            seen.add(next);
            pending.push(next);
          }
        }
        return true;
      });
      // 海岸と国境を両方描いた後の縦横比。周防大島など海を隔てた島は外す。
      const shapes = [];
      for (const [names,island,min,max] of [
        [['izu'],'honshu',0.49,0.65], [['nagato','suo'],'honshu',1.30,1.63],
        [['iwami'],'honshu',0.76,1.05], [['wakasa'],'honshu',1.14,1.55],
        [['osumi'],'kyushu',0.48,0.68],
      ]) {
        const ids = names.map(id=>E.PI[id]), mainland = Object.keys(GEO.coastlines).indexOf(island)+1;
        let left=Infinity, right=-Infinity, top=Infinity, bottom=-Infinity;
        for (const id of ids) {
          const m=masks[id];
          for (let y=m.y0; y<=m.y1; y++) for (let x=m.x0; x<=m.x1; x++) {
            const n=y*MW+x;
            if (idx[n]!==id || land[n]!==mainland) continue;
            left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
          }
        }
        const ratio=(right-left+1)/(bottom-top+1);
        if (!Number.isFinite(ratio) || ratio<min || ratio>max) shapes.push([names,ratio]);
      }
      const sea = [], wetRoads = [], borders = MAP.build.missing.slice();
      for (const nd of E.nodes.slice(E.P)) {
        if (nd.t === 'S') {
          if (land[pixel(pos[nd.i])]) sea.push(nd.key);
          continue;
        }
        for (const castle of [nd.a,nd.b]) {
          const path = [pos[castle], ...MAP.between(castle,nd.i), pos[nd.i]];
          for (let i=1; i<path.length; i++) {
            const [ax,ay] = path[i-1], [bx,by] = path[i];
            const samples = Math.max(1, Math.ceil(Math.hypot(bx-ax,by-ay)*RS));
            for (let k=0; k<=samples; k++) {
              const t = k/samples, p = [ax+(bx-ax)*t,ay+(by-ay)*t];
              if (!land[pixel(p)]) {
                wetRoads.push([DATA.PROV[castle].id, nd.key, p.map(Math.round)]);
                break;
              }
            }
          }
        }
      }
      return {castles,shores,detached,shapes,borders,sea,wetRoads};
    }""")


def view_regions(page, out_dir):
    page.locator('#b-atlas').click()
    regions = page.locator('#navi [data-r]').evaluate_all(
        "els => els.map(el => el.dataset.r).filter(r => r !== 'title' && r !== 'home')")
    for region in regions:
        page.locator(f'#navi [data-r="{region}"]').click()
        page.wait_for_function('!SG.R.camMoving()')
        page.evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
        if out_dir:
            # 地方図はナビの手前まで、全国図は世界座標の範囲までを収める。
            box = page.evaluate("""all => {
              if (all) {
                const a=SG.R.toScreen(0,0), b=SG.R.toScreen(SG.R.W,SG.R.H);
                return {x:Math.max(0,a[0]), y:Math.max(0,a[1]), width:Math.min(innerWidth,b[0])-Math.max(0,a[0]),
                  height:Math.min(innerHeight,b[1])-Math.max(0,a[1])};
              }
              return {x:0,y:0,width:document.querySelector('#navi').getBoundingClientRect().left-4,height:innerHeight};
            }""", region == 'all')
            page.screenshot(path=out_dir / f'{region}.png', clip=box)
    page.locator('#navi [data-r="title"]').click()
    page.locator('#b-new').wait_for(state='visible')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shots', type=Path, help='全国・地方の画面を保存するフォルダー')
    args = parser.parse_args()
    if args.shots:
        args.shots.mkdir(exist_ok=True, parents=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='msedge')
        ctx, page = open_page(browser, 1600, 1000)
        result = inspect_map(page)
        view_regions(page, args.shots)
        result['errors'] = page.errors
        for title, failures in result.items():
            print(title, len(failures), failures)
        ctx.close()
        browser.close()
    raise SystemExit(int(any(result.values())))
