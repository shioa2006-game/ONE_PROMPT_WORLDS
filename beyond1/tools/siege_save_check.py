"""同じ一時ブラウザの同じURLで0.2から新版へ切り替え、実際の自動保存と記録を引き継ぐ。"""
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
revision = "3e62d050b0cd455413e93ec80c37f7c9e62f4f02"
url = "http://saigake.test/beyond1/index.html?seed=37"
legacy = True

def serve(route):
    path = urlsplit(route.request.url).path.removeprefix("/beyond1/")
    if path != "index.html" and not path.startswith(("css/", "js/")):
        route.fulfill(status=404)
        return
    content = subprocess.check_output(["git", "show", f"{revision}:beyond1/{path}"], cwd=root) if legacy else (root / path).read_bytes()
    mime = {".js": "text/javascript", ".css": "text/css", ".html": "text/html"}[Path(path).suffix]
    route.fulfill(body=content, content_type=mime + "; charset=utf-8")

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="msedge")
    ctx = browser.new_context(viewport={"width": 1500, "height": 920})
    ctx.route("**/*", serve)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def click(selector):
        page.locator(selector).click(timeout=8000)

    def boot():
        page.goto(url)
        page.locator("#loading").wait_for(state="hidden")
        page.evaluate("SGT.speed.skip=true")

    def store_slot(i):
        click("#b-menu")
        click("#b-m-save")
        click(f'.slot[data-i="{i}"]')

    def open_slot(i):
        boot()
        click("#b-load")
        click(f'.slot[data-i="{i}"]')

    def state():
        return page.evaluate("JSON.stringify(SGT.S)")

    boot()
    click("#b-new")
    click('.clan[data-id="shimazu"]')
    click("#b-go")
    click("#b-intro-go")
    page.wait_for_function("SGT.S.cur==='shimazu' && !SGT.debug.busy()")
    store_slot(1)
    first = page.evaluate("localStorage.getItem('saigakeT_slot1')")
    # 旧エンジンの合法手だけで進め、兵8以上が敵城の隣に来た最初の季で画面に戻す。
    army = page.evaluate("""() => {
      const s=SGT.S, {E,AI}=SG;
      for (let i=0;i<6000 && !s.over;i++) {
        if (s.phase==='decide') E.extend(s);
        if (i) E.beginClanTurn(s);
        if (s.cur===s.player) {
          for (const offer of [...s.offers]) E.acceptOffer(s,offer.c);
          if (s.phase==='place') E.spawn(s,AI.chooseSpawn(s,s.cur));
          const a=s.armies.find(a=>a.c===s.cur && !a.mv && a.t>=8 && E.nodes[a.n].kind==='b' &&
            E.adj[a.n].some(p=>s.owner[p]!==s.cur));
          if (a && s.turn>=6) { SGT.debug.resync(); return a.id; }
        }
        if (!s.over) AI.playTurn(s);
        if (!s.over) E.advance(s);
      }
      throw Error('攻城できる局面に未到達');
    }""")
    click("#b-roll")
    page.wait_for_function("SGT.S.phase==='move' && !SGT.debug.busy()")
    old_auto = state()
    assert page.evaluate("localStorage.getItem('saigakeT_save')") == old_auto
    assert "siegePlan" not in old_auto
    store_slot(2)
    second = page.evaluate("localStorage.getItem('saigakeT_slot2')")
    legacy = False
    boot()
    click("#b-cont")
    assert state() == old_auto
    open_slot(1)
    assert state() == first
    open_slot(2)
    assert state() == second
    print("旧版の島津家の通常開始・進行済み記録、自動保存を完全一致で再開")

    def prepare():
        click(f'.arow[data-id="{army}"] .pl')
        button = page.locator("#gov button[data-target]:enabled").first
        assert button.is_visible()
        return_target = int(button.get_attribute("data-target"))
        button.click()
        page.wait_for_function("!SGT.debug.busy()")
        return return_target

    target = prepare()
    saved = state()
    assert page.evaluate("SGT.S.armies.some(a=>a.siegePlan) && SGT.S.dice.some(d=>d.u)")
    assert page.locator("#siege-summary").inner_text()
    click("#b-undo")
    assert state() == second
    assert prepare() == target
    assert state() == saved
    store_slot(3)
    boot()
    click("#b-cont")
    assert state() == saved
    open_slot(3)
    assert page.evaluate("SGT.S.armies.some(a=>a.siegePlan && a.mv)")
    assert page.evaluate("localStorage.getItem('saigakeT_slot1')") == first
    assert page.evaluate("localStorage.getItem('saigakeT_slot2')") == second
    turn = page.evaluate("SGT.S.turn")
    click("#b-end")
    if page.locator("#b-end.armed").count():
        click("#b-end")
    page.wait_for_function("t => SGT.S.turn>t && SGT.S.cur===SGT.S.player", arg=turn)
    print("旧記録から準備、取り消し、新しい自動保存・手動記録の再開、次の季へ進行")
    boot()
    click("#b-new")
    assert page.locator("#clans .clan").count() == 15
    click('.clan[data-id="takeda"]')
    click("#b-go")
    assert page.evaluate("SGT.S.player==='takeda'")
    assert not errors, errors
    print("新規の大名選択15家、武田家の開始、画面エラー0")
    browser.close()
