---
titel: "The Agentic OS Setup That Will 10x Claude Code – Deutsche Übersetzung"
quelle: https://www.youtube.com/watch?v=HRw-vP0j8OM
kanal: Chase AI
typ: transkript-übersetzung
datum: 2026-07-03
---

# The Agentic OS Setup That Will 10x Claude Code – Deutsches Transkript

> Vollständige deutsche Übersetzung des Videos von **Chase AI**.
> Quelle: <https://www.youtube.com/watch?v=HRw-vP0j8OM>
> Die Zeitmarken entsprechen dem Original.

---

**(00:00)** Wenn du nicht weißt, wie du dein eigenes Agentic OS baust, dann fällst du zurück. Aber nicht aus dem Grund, den du denkst. Es liegt nicht daran, dass du irgendein schickes Dashboard oder ein Jarvis-Setup brauchst, denn genau dort liegt der Wert dieser Systeme nicht. Der Wert steckt in allem unter der Haube. In allem, was du nicht sehen kannst. Ich rede von Loop-Engineering, Skill-Architektur, State-Management, dem Aufbau eines zweiten Gehirns – und der Fähigkeit, all das zu einem stimmigen, individuell angepassten Produkt zu bündeln, das für dich funktioniert.

**(00:28)** Genau dort liegt der Wert. Und die Fähigkeiten, die man braucht, um so etwas zu bauen, lassen sich auf jedes Projekt anwenden, an dem du mit Claude Code arbeitest – deshalb ist das so wertvoll zu verstehen. In diesem Video zerlegen wir also das Konstrukt „Claude Agentic OS" Ebene für Ebene, damit du nicht nur lernst, wie du selbst eins baust, sondern auch, warum es so wichtig ist, dass du es tust.

**(00:50)** Wenn wir uns ein Agentic OS wie dieses hier oder dieses Obsidian-basierte ansehen, ist es leicht, sich im visuellen Spektakel zu verlieren. All diese Buttons, beweglichen Teile und Metriken – Dinge, die du im Claude-Code-Terminal nicht findest – springen dir sofort ins Auge, und man landet meist in einem von zwei Lagern. Das erste Lager denkt: „Wow, das sieht wirklich cool aus.

**(01:09)** Das will ich haben. Ich liebe all diese visuellen Dinge, die ich sonst nirgends finde." Und das andere Lager sieht es so, wie es ist – nämlich als reine visuelle Oberfläche – und denkt: „Das ist alles nur Blendwerk. Hier gibt es nichts, was wirklich etwas voranbringt."

**(01:25)** Und ich glaube, beide Lager übersehen etwas. Und was sie übersehen, sind die KI-Grundlagen, die unter der Haube arbeiten und aus einem AIOS – aus einer nur schick aussehenden Web-App – eine maßgeschneiderte Waffe machen, mit der du jedes Problem mit Claude Code angehen kannst, oder ehrlich gesagt mit jedem Modell. Ich rede heute über Claude Code, aber das lässt sich genauso mit etwas wie Codex oder sogar einem lokalen Modell umsetzen.

**(01:44)** Und wenn wir über diese Grundlagen sprechen, können wir sie bei diesem AIOS grob in vier Bereiche unterteilen. Die erste Ebene ist das Rückgrat – das sind die Skills und das Loop-Engineering, also die Idee, dass wir alles, was wir in Claude Code tun, kodifiziert und entweder in einen Skill oder eine Art Automation verwandelt haben.

**(02:04)** Ebene zwei ist Memory und State-Control. Wie stellen wir sicher, dass unser AIOS eine Art Datenbank an Informationen hat, aus der es schöpfen kann, wenn wir ihm Fragen stellen? Und noch wichtiger: Können wir diesen State, dieses Gedächtnis nutzen – egal ob Obsidian oder etwas anderes. Du kannst auch etwas wie eine klassische Datenbank verwenden.

**(02:21)** Wie können wir das in Kombination mit den Skills und Automationen, die wir gebaut haben, nutzen, um tatsächlich sauber gebaute, loop-engineerte Konstrukte zu schaffen, die sich gewissermaßen selbst verbessern? Wenn du mein letztes Video über Loop-Engineering gesehen hast, weißt du ungefähr, wovon ich rede. Die Idee, dass wir Dinge festhalten und Loops einrichten müssen, die sehen können, wie wir in früheren Durchläufen abgeschnitten haben, um künftige Läufe zu verbessern.

**(02:44)** Und diese beiden Ebenen, eins und zwei, sind der Ort, an dem wir das meiste Geld verdienen. Das sind 90 % des Werts jedes AIOS. Und sobald du das im Griff hast, kannst du dich dem coolen visuellen Zeug zuwenden. Das ist quasi Ebene drei, wo wir über das Interface, die UI und den Anpassungsaspekt sprechen.

**(02:59)** Falls du raus aus dem Terminal willst und sozusagen deine Flügel ausbreiten willst – im Vergleich zu manchen dieser Desktop-Anwendungen –, denn die Claude-Desktop-App ist großartig, aber es gibt nur begrenzt viel, was man darin tun oder auf bestimmte Weise einrichten kann. Und zu guter Letzt haben wir Ebene vier: die Distribution.

**(03:13)** Denn das Coole daran ist: Es muss nicht nur persönlich für dich sein. Du kannst dein AIOS mit Teammitgliedern oder sogar Kunden teilen. Und es ist eine großartige Möglichkeit, das Niveau in deiner Organisation anzuheben. Vieles von dem, was du auf Ebene eins und zwei machst, lässt sich in einen buchstäblichen Button oder Sprachbefehl verwandeln, den du in die Benutzeroberfläche deines AIOS einbauen kannst und den jeder nutzen kann.

**(03:35)** Sie müssen Claude Code nicht einmal selbst ausführen. Alles kann für sie erledigt werden. Das sind also die vier Ebenen, über die wir heute sprechen. Ich werde den Großteil hier bei Ebene eins und zwei verbringen, denn die Wahrheit ist: Du könntest all das immer noch in deinem normalen Claude-Code-Terminal oder der Codex-CLI oder der Codex-Desktop-App machen, wenn du diese ersten beiden Teile – Skills und Loop-Engineering sowie Memory und State – wirklich draufhast.

**(03:58)** Das gilt für alle Probleme, nicht nur für ein AIOS. Aber bevor wir in Ebene eins eintauchen, ein kurzes Wort von unserem heutigen Sponsor – mir. Ich habe gerade meine Claude-Code-Masterclass veröffentlicht, und sie ist der beste Weg, um von null zum AI-Dev zu werden, besonders wenn du keinen technischen Hintergrund hast. Wir konzentrieren uns auf reale Anwendungsfälle.

**(04:13)** Sie wird jede Woche aktualisiert und enthält all meine persönlichen Builds. Also alles, was du in diesem Video für meine Demos siehst, findest du auch dort. Wenn du all das haben willst, findest du es in Chase AI Plus. Es gibt einen Link in der Beschreibung. Also, Ebene eins: Skill-Architektur, Loop-Engineering, all das.

**(04:30)** Worüber reden wir hier eigentlich? Nun, es gibt sozusagen vier Unterphasen von Ebene eins. Wir haben das Workflow-Audit, die Skill-Erstellung, die Automation und dann das Loop-Engineering. Schritt eins ist also ein Workflow-Audit. Bevor wir Skills erstellen können, müssen wir wissen, wofür du überhaupt Skills brauchst.

**(04:49)** Denn erinnere dich: Warum sind Skills wohl das Mächtigste in Claude Code? Weil sie uns erlauben, einen bestimmten Output zu erhalten. Wir sagen Claude, es soll eine bestimmte Sache auf eine bestimmte Weise für einen bestimmten Output tun. Aber welche bestimmten Outputs brauchst du ständig in deinem Tag und deiner Woche? Scheint eine offensichtliche Frage zu sein, und doch können die meisten Leute sie nicht beantworten.

**(05:10)** Und selbst wenn sie sie beantworten können, haben sie diese Workflows, die sie manuell in Claude Code machen, sicher nicht in Skills verwandelt oder automatisiert. Das ist also das Erste, was du tun musst. Und das allein wird – selbst wenn du sonst nichts machst – total aufladen, wie du mit Claude Code arbeitest. Hier eine bildliche Darstellung dessen, wovon ich rede.

**(05:29)** Wir haben dich und wir haben Claude Code. Und für die meisten Leute bleibt es genau so. Es ist ein rein manuelles Hin und Her. Du öffnest das Terminal, du öffnest Claude Desktop, und du sagst ihm, bestimmte Dinge zu tun. Und unweigerlich sagst du ihm die ganze Zeit, dieselben Dinge zu tun. Was wäre, wenn wir stattdessen ein Audit von allem machen, was du täglich und wöchentlich tust, und all die Arten, wie du Claude nutzt, und das in Skills kodifizieren? Du machst dieselben Aufgaben immer und immer wieder.

**(05:55)** Warum sind wir nicht einfach konsistent mit den Outputs und der Art, wie sie funktionieren? Wenn du Skills in irgendeiner Form genutzt hast, ist die Botschaft hier offensichtlich. Ich sage dir im Grunde nur, das zu tun, was du mit Skills ohnehin schon tust – aber hundertmal mehr. Denn zweifellos lässt sich die Art, wie du Claude Code nutzt, ob als Einzelperson oder als Unternehmen, in eine Reihe verschiedener Domänen aufteilen.

**(06:14)** Bei mir sind das Dinge wie Research, Content, meine Online-Community, meine Agentur, mein Sales und so weiter und so fort. Und unter jeder dieser Domänen gibt es verschiedene Dinge, die ich tue – konkrete Aufgaben für Content, zum Beispiel: Ich muss Outlines für alle meine Projekte machen. Ich muss die Hooks für meine Videos herausfinden. Ich muss meinen Content wiederverwerten.

**(06:33)** Ich muss Karussells erstellen. Und so weiter und so fort. Warum sind das keine Skills? Ehrlich gesagt sollten sie es sein. Und doch haben die meisten Leute wahrscheinlich kein großes, robustes Set an Skills, wie ich es hier habe. Und das ist der einfachste Weg, Claude Code zu verbessern. Die praktische Frage ist nun: Wie macht man das in großem Maßstab? Und es gibt ein paar verschiedene Wege.

**(06:57)** Nummer eins: Wir machen das rein manuell. Das heißt, ich gehe in Claude Code hinein. Ich habe schon eine Vorstellung davon, was ich tue. Ich erkläre diese Aufgabe und verwandle sie dann in – kann nicht tippen – wir verwandeln sie in einen Skill. Und natürlich verwenden wir dafür den Skill-Creator-Skill, richtig? Einfach genug.

**(07:20)** Das Problem dabei ist, besonders wenn du es noch nie gemacht hast: Du hast wahrscheinlich nicht validiert, wie Claude Code dabei vorgehen sollte. Das ideale Szenario ist, dass du das manuell gemacht hast. Du hast bestätigt, dass es tatsächlich funktioniert, und dann sagst du Claude Code: „Hey, siehst du, wie wir diese Aufgabe gerade erledigt haben? Jetzt möchte ich, dass du sie in einen Skill verwandelst."

**(07:38)** Und es gibt tatsächlich Wege, das relativ schnell zu tun, denn erinnere dich: Claude Code hat im Grunde Zugriff auf all deine früheren Sessions. Es kann die Tool-Calls sehen. Es kann sehen, was du ihm zu tun aufgetragen hast. Es hat das gesamte Hin und Her. Wir können uns beim Aufbau dieses Skill-Repositorys einen echten Vorsprung verschaffen, indem wir Claude Code sagen: „Hey, ich möchte, dass du dir unsere letzten drei, fünf, zehn, zwanzig Sessions ansiehst."

**(08:01)** „Ich möchte, dass du alles herausziehst, was wir gemacht haben, und mir eine Liste von Dingen gibst, die wir in Skills verwandeln können und die ich ständig tue." Das wird also Option Nummer zwei: Wir lassen es sich vorherige Sessions ansehen und die Arbeit sozusagen aus uns herausziehen. So basiert es auf echten Daten. Das ist kein Ratespiel darüber, was du denkst, was du in Claude Code tun solltest.

**(08:22)** Es wird sich tatsächlich ansehen, was du getan hast. Und dieser Prompt kann einfach ungefähr so klingen: „Hey, kannst du unsere letzten 10 Sessions durchgehen, die ich mit dir hatte? Und ich möchte, dass du wiederkehrende Aufgaben oder Dinge herausziehst, die wir immer wieder gemacht haben und die noch keine Skills sind, die ich aber in Skills verwandeln will – und erstelle eine Art Tabelle, die zeigt, was die Aufgabe ist, was der Output sein sollte und der vorgeschlagene Skill." Das ist im Grunde alles.

**(08:47)** Muss nicht ausgefallen sein. Du kannst in einfacher Sprache mit ihm reden. Und wie du hier sehen kannst – was tut es? Es wird zuerst unsere Session-Dateien finden. Es gibt tatsächlich eine dritte Option, wie wir das angehen können. Option Nummer drei: Wir lassen es ein Interview führen, richtig – wir lassen Claude Code uns interviewen, und wir sagen: „Hey, ich gebe dir einfach einen Bewusstseinsstrom darüber, was ich täglich und wöchentlich tue, und ich möchte, dass du Fragen stellst, falls es blinde Flecken gibt, und dann möchte ich, dass Claude Code aus

**(09:18)** diesem Gespräch die Aufgaben herauszieht, die sich in Skills verwandeln lassen." Also dieselbe Idee. Es wäre derselbe einfache Prompt. Wir holen ihn gleich hoch. Und dann würde ich etwa sagen: „Ich versuche, all meine täglichen und wöchentlichen Aufgaben in Skills zu verwandeln, wenn es Sinn ergibt."

**(09:39)** „Ich fange also damit an, dir einen Bewusstseinsstrom davon zu geben, was ich jeden Tag tue. Und dann möchte ich, dass du es in ein Interview verwandelst und blinde Flecken ansprichst, denn am Ende möchte ich, dass du so viel Kontext wie möglich darüber hast, was ich tue und welche Ergebnisse ich anstrebe. Und ich möchte, dass du konkrete Aufgaben herausziehst, damit ich diese Aufgaben in Skills und schließlich in Automationen verwandeln kann."

**(10:03)** Das ist im Grunde alles. Muss nicht ausgefeilter sein als das. Die ganze Idee ist, dass wir einfach so viel Kontext wie möglich über unsere Arbeit, unseren Tag, unsere Woche in Claude Code werfen und ihn kodifizieren. Wir wollen im Grunde einfach das, was wir tun, in eine Checkliste verwandeln. Das ist so wie das Sprichwort – die Art, wie du das angehen solltest, ist, als hättest du jemanden als persönlichen Assistenten eingestellt.

**(10:24)** Du willst so viele Aufgaben wie möglich auf ihn abwälzen. Wie würdest du das tun? Nun, das ist ziemlich offensichtlich. Du würdest ihm sagen, was du tust, und ihm dann Schritt-für-Schritt-Anweisungen geben, das zu tun. Das ist alles, was wir tun. Wir machen es nur mit Claude Code. Und doch tun die meisten Leute das nicht.

**(10:40)** Und weil das Skills sind, sind das jetzt greifbare Workflows, die wir ansehen und nach Bedarf bearbeiten können, bis wir diese Outputs wirklich feingetunt haben. Und hier siehst du eine der wiederkehrenden Aufgaben, die ich aus früheren Sessions herausgezogen habe. Dinge wie das Prüfen auf Tool- und Repo-Updates für Videos. Und so geht es weiter und weiter mit den gefundenen Aufgaben.

**(10:57)** Diese Skills zu erstellen ist nur Schicht Nummer eins davon, richtig? Wir haben es kodifiziert. Und oft sind das Dinge, die sich immer und immer wieder wiederholen. Nun, wenn sie sich immer wieder wiederholen, gibt es dann irgendeinen Grund, warum wir sie nicht einfach in Automationen verwandeln, richtig? Wieder: Wir wollen weg von diesem manuellen Ansatz bei allem.

**(11:16)** Ich hatte also diese Aufgabe, die ich manuell gemacht habe. Jetzt ist sie ein Skill. Sie ist kodifiziert. Nun, jetzt richten wir sie einfach als Automation ein, wenn es Sinn ergibt. Und das ist in Claude Code so einfach zu tun. Wir können es buchstäblich einfach prompten: „Können wir diesen Skill in eine Automation verwandeln?" Und wenn du einen visuelleren Ansatz willst, kannst du das sehr einfach in Claude Desktop einrichten.

**(11:34)** Wir gehen einfach zu „Routines". Wir geben ihr einen Namen. Sagen wir „auto one". Die Anweisung wäre einfach: „Führe diesen Skill aus." Setze den Namen des Skills ein. Und dann setzen wir es auf einen bestimmten Zeitplan. Das ist im Grunde alles. Und die dritte Ebene hier wäre, ein gewisses Maß an Loop-Engineering einzurichten. Ich gehe jetzt nicht ultratief ins Loop-Engineering, weil das Video, das ich gestern veröffentlicht habe, das definitiv tut, aber wir haben sozusagen die Grundlage für starke Loops. Wir haben den Skill.

**(12:04)** Wir haben ihn in eine Automation verwandelt. Jetzt ist es einfach eine Frage: Nehmen wir eine bestimmte Automation und versuchen wir, eine Art Selbstverbesserungs-Loop hinzuzufügen? Und das wird auch mit Memory und State zusammenhängen. Aber das ist alles, was ich dazu wirklich erwähnen werde. Versteh einfach: Wenn du jemand bist, der ins Loop-Engineering und diese ganze Seite der Gleichung eintauchen will, bist du dafür sehr gut aufgestellt, da wir mit unseren Skills und Automationen die Grundlage gelegt haben.

**(12:28)** Aber zoomen wir kurz raus: Das ist das Rückgrat von allem. Es geht darum, dein Leben zu kodifizieren und es so einzurichten, dass wir konsistente Outputs von Claude Code für die Aufgaben bekommen, die uns wirklich wichtig sind. Und wie du dir vorstellen kannst, hat das eigentlich nichts mit diesen schicken Dashboards und all dem anderen Zeug zu tun, das mit einem OS daherkommt.

**(12:50)** Ich liebe die schicken Dashboards. Ich finde sie wirklich cool, aber das hier ist die Power. Und du kannst dir vorstellen, das auf jedes Problem und jeden Anwendungsfall mit Claude Code anzuwenden – das ist sehr einfach und unkompliziert. Es erfordert keine der anderen Ebenen, weshalb es meiner Meinung nach wichtig ist, sein eigenes AIOS bauen zu können. Denn während wir diese Ebenen aufeinanderstapeln, siehst du, wie modular und flexibel das ist.

**(13:12)** Also: Workflow-Audit – ich habe über die drei verschiedenen Wege gesprochen, das zu tun, richtig? Wir können es manuell machen, wir können es unsere vorherigen Sessions ansehen lassen, oder wir können es ein Interview führen lassen. Sobald wir das getan haben, lassen wir es die Skills erstellen. Dann fragen wir uns: Hmm, kann einer dieser Skills automatisiert werden? Und schließlich führen wir diese Diskussion darüber, ob Loop-Engineering für diesen konkreten Anwendungsfall Sinn ergibt. Und apropos Loop-Engineering – das bringt uns zu Dingen wie State und Memory, was Ebene zwei ist. Nun, vieles von dem, was ich

**(13:38)** heute besprechen werde, wird im Kontext von Obsidian sein, aber versteh: Es muss nicht Obsidian sein. Alle reden gern über Obsidian, weil es kostenlos und relativ leicht zu verstehen ist. Alles, was mit Obsidian funktioniert, lässt sich auch in einer klassischen Datenbank machen, richtig? Es muss nicht Obsidian sein.

**(13:55)** Obsidian ist einfach unkompliziert in der Nutzung. Und wirklich, noch mehr als Obsidian geht es um die Idee von Dateistrukturen und darum, Claude Code auf stimmige Weise einzurichten. Ehrlich gesagt könntest du wahrscheinlich gar keine Datenbank und gar kein Obsidian haben. Und wenn du Claude Code einfach mit einer Dateistruktur einrichtest, die stimmig ist und Sinn ergibt, bist du zu etwa 99 % am Ziel.

**(14:17)** Obsidian macht es einfach nur leicht. Und Datenbanken haben natürlich ihre eigene Power, die damit einhergeht. Also, wie sollten wir diesen Teil der Gleichung einrichten? Nun, wir beantworten diese Frage durch die Linse von Obsidian und dessen, was die Dateistruktur für uns tun sollte. Obsidian ist, wie ich vorhin erwähnt habe, völlig kostenlos.

**(14:34)** Die Idee bei Obsidian ist, dass du es einfach herunterlädst und dann einen Ordner auf deinem Computer als Vault festlegst. Es kann jeder Ordner sein oder ein brandneuer Ordner. Wenn du Obsidian installierst, siehst du ein Popup wie dieses, wo du wieder einen neuen Vault erstellen oder einen Ordner als Vault öffnen kannst. Wenn wir von einem Vault sprechen, ist es wieder buchstäblich nur ein Ordner.

**(14:53)** Du musst dich also für dieses Agentic OS fragen: In welchem Ordner sollte es leben? Welcher Ordner wird all die Informationen enthalten, über die ich Bescheid wissen will? Wenn wir es also wie einen persönlichen Assistenten behandeln, ist vielleicht eine der Domänen, bei denen es dir helfen soll, so etwas wie Sales. Du hast also viele Sales-Daten. Nun, welchen Ordner ich auch immer als Vault festlege, ich möchte mindestens eine Kopie all meiner Sales-Daten dort hineinlegen. Das ist ungefähr die Idee.

**(15:15)** Sobald wir einen Ordner als Vault festgelegt haben, ist es, um Claude Code mit Obsidian zu verbinden, so einfach, wie Claude Code einfach innerhalb des Vaults zu öffnen. Ich navigiere also in meinem Terminal zu dem Ordner, wie auch immer ich ihn genannt habe. In diesem Fall habe ich meinen Vault buchstäblich „the vault" genannt. Ich bin jetzt also im Vault.

**(15:34)** Als Nächstes öffne ich einfach Claude Code, und bumm – Claude Code ist für alle praktischen Zwecke jetzt mit meinem Vault verbunden. Ich habe also jetzt meinen Vault, und Claude Code ist geöffnet und damit verbunden. Nun stellt sich die Frage: Wie richte ich eigentlich meine Dateistruktur innerhalb des Vaults ein? Das ist keine triviale Frage.

**(15:56)** Das ist sehr wichtig, denn der ganze Mehrwert von etwas wie Obsidian ist die Idee, dass Claude Code mit einem Ordner verbunden und darin geöffnet werden kann, der zig Unterordner und zig Dateien in diesen Ordnern hat. Und du, der Mensch, kannst Claude Code eine Frage zu irgendeiner der Dateien und Ordner hier drin stellen, und es gibt dir eine genaue und schnelle Antwort.

**(16:21)** Wie machen wir das? Nun, es kommt alles darauf an, wie wir das einrichten, richtig? Wenn wir einfach einen Ordner mit 10 Millionen Dateien darin haben und es keine Backlinks gibt und nichts verbunden ist und es keine Hierarchie gibt, wird Claude Mühe haben, dir schnell eine Antwort zu finden. Und wenn ich sage, es ist langsam, meine ich auch, dass es mehr Tokens verbraucht und dich letztlich mehr Geld kostet.

**(16:42)** Wir müssen das also klar einrichten. Dein mentales Modell hier ist, eine Landkarte für Claude Code zu erstellen, richtig? Wir betrachten den Knowledge-Graph meines Obsidian-Vaults. Das sind all die Dateien in meinem Vault und wie sie miteinander verbunden sind. Das ideale Szenario ist, dass Claude Code, wenn ich ihm eine Frage über etwas in diesem riesigen Wust an Dateien stelle, einen sehr klaren Pfad hat, um diese Datei zu finden und damit meine Antwort.

**(17:09)** Stell dir Obsidian also im Grunde als deinen Aktenschrank für alles vor. Es hat sich mittlerweile eine gewisse gängige Art etabliert, seine Dateistruktur in Obsidian einzurichten, wenn wir über Claude Code sprechen. Und das kommt von Karpathy. Dieser Tweet von Karpathy hatte über 20 Millionen Aufrufe und drehte sich ganz darum, wie er seine Wissensbasis mit Obsidian einrichtet, damit große Sprachmodelle wie Claude schnell und effektiv auf Informationen zugreifen können.

**(17:36)** Und es geht ungefähr so: Wir haben den primären Vault, den du jetzt kennst. Und dann haben wir sozusagen drei Unterordner. Wir haben einen Unterordner, den wir den `/raw`-Ordner nennen. R-A-W. Dieser Ordner ist der Ort, an den alle unstrukturierten Daten kommen. Darunter haben wir einen weiteren Unterordner namens `wiki`-Ordner.

**(18:00)** Der Wiki-Ordner ist der Ort, an dem wir die unstrukturierten Daten genommen haben. Stell dir vor: Wir haben gerade all diese Recherche über, sagen wir, KI-Agenten gemacht, richtig – ein Haufen unstrukturierter Daten, darunter ein Haufen Artikel und all so etwas – und wir haben es in strukturierte Daten verwandelt. Wir haben es jetzt in einen Artikel im Wikipedia-Stil über KI-Agenten verwandelt.

**(18:20)** Die Daten und alles, was hier vor sich geht und was wir darüber wissen wollen, sind also sehr klar, richtig? Statt zu versuchen, 20 verschiedene Quelldokumente durchzugehen, haben wir jetzt alles schön ordentlich unter dieser Wiki-Datei. Der dritte Unterordner im Vault ist im Grunde für Outputs.

**(18:37)** Sagen wir also, ich habe meine Recherche über KI-Agenten gemacht, die jetzt im Raw-Ordner ist, Ordner Nummer eins. Ich verwandle das dann in strukturierte Daten, in einen Wikipedia-Artikel, der in Ordner Nummer zwei ist. Jetzt möchte ich das verwandeln in – lass mich das hier rüberziehen – sagen wir, ich möchte das jetzt in, ich weiß nicht, ein Slide-Deck verwandeln.

**(18:58)** Okay, eine Art klares Deliverable, richtig? Wir reden hier nicht nur über Daten. Wir haben es tatsächlich in etwas Nützliches verwandelt. Nun, das wäre Ordner drei. Okay. Und die Idee ist: Für die meisten Daten, mit denen wir hantieren, können wir es sozusagen so einrichten. Unstrukturiert, strukturiert und dann Outputs.

**(19:16)** Das ist die Karpathy-Obsidian-RAG. Und ich sage RAG in Anführungszeichen, weil das ein neues RAG-System ist. Aber das ist eine Art, es zu machen. Nun, das Schöne an diesem Karpathy-System ist nicht unbedingt, dass wir es in unstrukturiert, strukturiert und Outputs aufteilen. Das wirklich Schöne ist, dass wir auf jeder Ebene davon eine `index.md`-Datei haben, richtig? Das ist einfach ein Textdokument, eine Markdown-Datei, die Claude Code auf jeder Ebene, in die wir hinabsteigen, sagt, was es gerade betrachtet.

**(19:46)** Wenn ich zum Beispiel mit Claude Code rede, mit meinem AIOS, und sage: „Hey, ich möchte, dass du mir alle Informationen über KI-Agenten gibst. Erinnere dich, wir haben einen Wiki-Artikel über KI-Agenten erstellt." Nun, das Erste, was es tun wird, ist, im Vault nachzusehen, und es wird auf diese `index.md` stoßen. Und diese

**(20:06)** `index.md` wird sagen: „Hey, auf dieser Ebene unseres Systems haben wir eine Raw-Datei für unstrukturierte Daten, ein Wiki für strukturierte Daten und Outputs für Dinge wie Slide-Decks und so etwas." Claude Code weiß also sofort: „Hey, er wollte Informationen über KI-Agenten. Also gehen wir zu diesem Wiki-Artikel." Nun, innerhalb des Wiki-Artikels, beziehungsweise innerhalb des Wiki-Ordners – rate mal, was hier drin ist? Es gibt auch eine `index.md`.

**(20:29)** Nun, wir haben einen Artikel hier drin. Braucht es also wirklich im Grunde ein Inhaltsverzeichnis für einen Ordner mit einem einzigen Ding darin? Nein, natürlich nicht. Aber was, wenn du das ein oder zwei oder fünf Jahre lang benutzt hast und nicht ein oder zwei oder zehn, sondern Tausende Dokumente hier drin hast, und möglicherweise auch Unterordner? Nun, eine

**(20:48)** `index.md` wird es für Claude Code viel leichter machen, auf diesen Ordner zu stoßen und zu verstehen, was es betrachtet und wohin es muss. Denn erinnere dich: Was ist der Zweck von all dem? Claude Code eine Landkarte zu geben. Und wenn es bei jedem neuen Raum, den es betritt, einen klaren Ort gibt, zu dem es gehen kann, um herauszufinden, was es betrachtet, wird es schneller und billiger sein.

**(21:07)** Und es ist wichtig zu verstehen, dass die Power daher kommt, nicht unbedingt von den etwas willkürlichen Ordnern, die wir erstellt haben. Es muss einfach wissen, wohin es geht. Du musst nicht „raw" machen. Du musst nicht „outputs" machen. Du musst nichts von diesem Karpathy-Zeug machen. Du brauchst einfach eine Landkarte für Claude Code, die Sinn ergibt. Und sie wird wahrscheinlich einzigartig für dich sein, weil deine Datenstrukturen und das, was du erreichen willst, immer einzigartig sein werden.

**(21:30)** Du hast also eine bessere Antwort als irgendjemand sonst dafür, wie du das strukturieren solltest. Nun, wenn du diese Antwort nicht hast – rate mal, wer dir helfen kann? Claude Code. Sag ihm einfach, sich deinen Vault anzusehen, und sag: „Hey, welche Struktur ergibt Sinn? Oh, nutze Karpathys Obsidian-RAG-Setup als Inspiration." Das wird ungefähr alles tun, was du brauchst.

**(21:46)** Das Einzige, was ich noch erwähnen würde, wäre: „Hey, lass uns eine `claude.md`-Datei erstellen, die darüber spricht." In meiner `claude.md`-Datei innerhalb meines Vaults geht es um meine Vault-Konventionen, konkret die Vault-Struktur, also welche Dateien und Ordner es betrachtet. Du kannst hier links sehen, ich habe nicht nur drei. Ich habe mehrere.

**(22:03)** Ich habe „content", „notes", „runs", „inbox", „ops", „projects" und so weiter und so fort. Außerdem habe ich eine ganze Sache über das Navigationsmuster, das im Grunde sagt: „Hey, wenn du versuchst, etwas zu finden, hier ist der Pfad, dem du folgen solltest." Und ich finde, so eine Vorlage zu nutzen ist sehr flexibel. Du kannst sie auf jede Struktur oder jede Art von Daten anwenden, mit denen du arbeitest, und dir etwas ausdenken, das für dich effektiv ist.

**(22:25)** Wenn wir also über Ebene zwei sprechen, ist es genau das, worüber wir sprechen. Wir geben Claude Code eine Landkarte, und sie muss Sinn ergeben. Nun spielt das auch ins Loop-Engineering hinein – und in Skills und Automationen –, denn all diese Outputs müssen irgendwohin, und sie müssen protokolliert werden, und sie sollten auf eine Weise protokolliert werden, die – ihr wisst, was ich sagen werde – Sinn ergibt fürs Loop-Engineering, speziell wenn wir über selbstverbessernde Skills und Automationen sprechen.

**(22:47)** Nun, damit das funktioniert, brauchen wir irgendwo, wo Claude Code sehen kann, was die vergangenen Läufe getan haben – beziehungsweise wo der Loop sehen kann, welche vergangenen Läufe er gemacht hat. Dann kann er künftige Verbesserungen vornehmen. Und das sollte alles am selben Ort zusammengeführt werden. Und wenn du diese beiden Ebenen meisterst, hast du 90 % der Power eines AIOS bereits zur Hand.

**(23:08)** Und all das lässt sich über das Terminal oder die Desktop-App oder was auch immer machen, denn an diesem Punkt hast du deine Workflows kodifiziert und hast jetzt eine Möglichkeit, tatsächlich zu sehen, was vor sich geht, aufzuzeichnen, was vor sich geht, sozusagen dein zweites Gehirn zu erschaffen und Claude Code zu erlauben, Erkenntnisse herauszuziehen, die du sonst nicht auf effiziente Weise hättest.

**(23:25)** Nun, Ebene drei ist der Punkt, an dem wir eine individuelle visuelle Hülle um alles legen, was wir bis hierhin gemacht haben. Und wir haben ein paar Optionen, wie wir das tun. Offensichtlich kann es rein individuell sein, aber wir können daraus etwas machen, das rein Web-App-basiert ist, oder etwas, das Obsidian-basiert ist.

**(23:40)** Wenn wir von Web-App-basiert sprechen, reden wir von so etwas hier. Wieder: Das ist Claude Code unter der Haube. Es ist mit Obsidian verbunden, aber ich habe jetzt einen Haufen individueller Metriken, die ich auf das abgestimmt habe, was ich sehen muss. Für mich zeigt es links Zeug rund um meine Content-Erstellung, richtig? Wie ist mein YouTube-Abonnentenstand, Instagram, mein neuestes Video, mein Claude-5-Stunden-Fenster? Ich habe Direktiven, die aus meinem Google-Kalender gezogen werden.

**(24:03)** Ich kann Dokumente ansehen, die es erstellt hat. Hier rechts habe ich einen Haufen meiner Automationen und Skills genommen und sie in einzelne Buttons verwandelt. Wenn ich also einfach auf etwas wie „Inbox Brief" klicke, kannst du jetzt sehen, dass es eingereiht ist. Es ist gleich hier aufgetaucht. Und unter der Haube läuft Claude, geht meine Inbox durch, erstellt Entwürfe und wird mir mitteilen, was es für wichtig hält.

**(24:25)** Und das Coole daran ist wieder: Du kannst die hier angezeigten Metriken zu allem machen, was du willst. Die ganze Idee, dass das ein Mechanismus zum Anheben des Niveaus ist. Die Idee, dass ich jetzt einen Teil der Power von Claude Code an nicht-technische Teammitglieder und Kunden weitergeben kann. Wir sprechen darüber in Ebene vier – es hat viel mit dem zu tun, was du hier rechts siehst, wo wir Automationen und Skills in einen Button verwandelt haben, den du buchstäblich drücken kannst.

**(24:48)** Statt ihnen also zu sagen: „Hey, lern, wie man Claude Code benutzt, hier ist ein Skill, den du installieren musst, hier ist, wie du den Skill ausführst, hier ist, wie du ihn automatisierst" – nein, ich richte einfach dieses AIOS für sie ein. Und jetzt können sie einfach einen Button klicken, und es erledigt all das für sie, und es wirft es entweder in ihr eigenes Obsidian oder das Team-Obsidian.

**(25:05)** >> Inbox Brief ist fertig. Inbox Brief bereit. 32 Threads sortiert, wobei ein Gear-Up-Vertrag und die Open-AI-Merge-Kampagne als dringend markiert sind. >> Also gut, das reicht jetzt von dir. Aber ja, du kannst hören, in diesem Fall habe ich auch ein Sprachmodell daran angeschlossen. Ich kann also mit ihm reden. Es kann zurücksprechen. Und dieses Sprachmodell ist übrigens komplett lokal.

**(25:27)** Richtig? Das läuft auf meinem tatsächlichen Computer, das geht nicht raus zu 11 Labs. Es ist also kostenlos. Wenn ich auf den Inbox Brief klicke, ruft es das gesamte Write-up auf. Und auch das ist etwas, das ich in Obsidian öffnen kann. Und apropos Obsidian: Du kannst auch ein Command-Center erstellen, eine visuelle Schicht innerhalb von Obsidian selbst.

**(25:46)** Und das ist es, was wir hier sehen. Die Metriken sind ein bisschen anders, aber sie sind ähnlich. Ich kann meinen Token-Verbrauch sehen. Ich habe, weißt du, dasselbe Setup, wo ich einen Button klicke und es Skills oder Automationen ausführt. Ich habe verschiedene Tabs. Für mich will ich mehr Einblick in so etwas wie Audience-Metriken auf der Content-Seite sowie etwas Research-Zeug.

**(26:06)** Du kannst das also extrem individuell gestalten. Und wieder: Die Botschaft hier ist an diesem Punkt nicht das schicke Visuelle. Es ist, dass ich eine zentrale Anlaufstelle für viele verschiedene Dinge haben kann, in die man etwas schwerer Einblick hat, wenn man strikt im Terminal ist. Was nun das Erstellen von so etwas angeht: Die Web-App ist genau wie das Erstellen irgendeiner Web-App mit Claude Code.

**(26:27)** Du wirst ihm eine Art visuelle Vorstellung geben. Ich meine, meine genauen Setups findest du natürlich in Chase AI Plus, aber du solltest einfach irgendeine Website oder ein Setup finden, das dir gefällt. Du kannst einen Screenshot davon machen. Du würdest ihn in Claude Code werfen und im Grunde sagen: „Hey, hier sind all die Skills, die ich schon benutze."

**(26:44)** „Ich will das mit dem Vault verbunden haben. Hier sind die Metriken, die mir wichtig sind, die ich an einem Ort sehen will. Lass uns das erstellen." Lass uns eine visuelle Hülle über all das legen. Und dasselbe gilt für Obsidian. Obsidian läuft in einem Plugin-System. Du erstellst also im Grunde eine App, aber sie ist spezifisch für Obsidian.

**(27:03)** Und wenn du Claude Code einfach sagst: „Hey, kannst du sozusagen die Web-App nehmen, die wir gerade erstellt haben, und eine Obsidian-Plugin-Version davon erstellen?" – wieder wird es dir so etwas geben. Und du installierst es einfach und führst es von Obsidian aus. Nun eine kurze Anmerkung dazu, was hier unter der Haube vor sich geht. Unter der Haube: Wenn ich einen dieser Buttons klicke, die wieder mit Skills zusammenhängen –

**(27:21)** sagen wir, ich klicke den „Morning Brief"-Skill. Was passiert eigentlich? Nun, das ruft im Grunde eine Headless-Version von Claude Code auf. Es ist also genau so, als hätte ich mein Terminal geöffnet und eine Version von Claude Code läuft, und es wird jetzt `/morning brief` ausführen. Der Unterschied ist: Wenn ich diesen Button klicke, macht es eine Headless-Version davon.

**(27:43)** Dieses Terminal taucht also nicht buchstäblich auf deinem Computer auf. Es ist headless. Es ist unsichtbar. Und es verwendet einen Befehl namens `claude -p`. Nun gab es vor nicht allzu langer Zeit etwas Drama um `claude -p`, weil Anthropic ankam und sagte: „Hey, wenn du `claude -p` benutzt, wird es nicht aus deinem Claude-Abo schöpfen. Es wird aus diesem 200-Dollar-Guthaben schöpfen, das an API-Kosten gebunden ist." Das war irgendwie ein Problem.

**(28:07)** Allerdings sind sie davon sozusagen zurückgerudert, und das ist noch nicht eingetreten. Also im Moment schöpft das noch aus deinem Max-Plan. Es ist also dasselbe, als hättest du dein Terminal geöffnet und es ausgeführt. Und so sind wir in der Lage, diese Art von Strukturen zu erschaffen, die trotzdem auf Claude Code zugreifen.

**(28:22)** Wir bekommen die ganze Power aus Claude Code, aber es wird unsichtbar hinter den Kulissen gemacht. Wenn wir also über Ebene drei sprechen – worauf läuft das hinaus? Nun, auf Individualisierung. Wir sind nicht ans Terminal oder die Desktop-App gefesselt. Wir können es anzeigen lassen, was auch immer wir wollen. Wir haben auch die Möglichkeit, das an Mitglieder unseres Teams zu geben.

**(28:37)** Das ist es, worüber wir in Ebene vier sprechen: Distribution. Ich habe es vorhin ein wenig erwähnt. Wenn ich jemandem diese Web-App gebe, und sie ist an all diese verschiedenen Skills gebunden, sind sie nur einen Klick davon entfernt, viel Power aus Claude Code zu bekommen. Denn erinnere dich: Die ganze Power kommt aus diesen Skills und Automationen. Wenn ich es für jemanden super einfach mache, die zu nutzen, ist es quasi so, als würde ich sie auf Claude Code aufsetzen, ohne sie tatsächlich auf Claude Code aufzusetzen.

**(28:57)** Die offensichtliche Frage wird dann: Nun, wie würdest du es tatsächlich an sie verteilen? Und es gibt ein paar Optionen. Wenn wir über etwas Web-basiertes sprechen, ist es tatsächlich viel einfacher. Jemandem das zu geben, im Vergleich zur Obsidian-Version, ist viel einfacher, denn da es Web-basiert ist, kann ich es auf GitHub packen.

**(29:13)** Ich kann, weißt du, einen ganzen Zip-Ordner erstellen. Es ist sehr einfach für mich, es an sie zu übertragen und zum Laufen zu bringen – im Vergleich zu etwas wie Obsidian. Obsidian ist da ein bisschen schwieriger. Obsidian würde also etwas mehr Handarbeit von dir erfordern. Falls du also sagst: „Hey, ich mag dieses Obsidian-Command-Center-Ding wirklich.

**(29:30)** Wie würde ich das einem Teammitglied bringen?" – nun, du müsstest es sozusagen für sie einrichten. Es ist nicht so unkompliziert. Es ist nicht viel schwieriger, aber es ist nicht so einfach wie: „Hey, hier ist ein GitHub-Repo, klon es einfach und richte Claude Code darauf." Aber wieder: Das Individualisierungsstück ist hier ein riesiges Verkaufsargument, besonders für diejenigen unter euch, die irgendeine Art von Kundenarbeit machen.

**(29:49)** Ich kann dir nicht sagen, wie viele Leute KI nutzen und Claude nutzen wollen, aber vom Terminal und selbst der Desktop-App völlig abgeschreckt oder ehrlich gesagt einfach richtig verängstigt sind. Es ist für die meisten Leute eine Brücke zu weit. Wenn du dieses Video schaust, spottest du wahrscheinlich darüber. Aber ich sage dir: Du lebst in einer Blase – 99 % der Leute gehen da einfach nicht hin, egal was du tust.

**(30:07)** Und sagen zu können: „Hey, stattdessen werfe ich dir einfach das hier zu, und ich richte es für dich ein, und du redest entweder per Stimme damit oder drückst ein paar Buttons" – das macht einen großen Unterschied. Der Dashboard-Effekt bei einer nicht-technischen Bevölkerung müsste wirklich mal untersucht werden, denn er verändert, wie Leute diese technischen Tools interpretieren.

**(30:23)** Und wenn wir jetzt rauszoomen, nachdem wir Ebene drei und vier durchgegangen sind, siehst du, sie sind wirklich nur das i-Tüpfelchen des AIOS. Fast die ganze Power, fast deine ganze Zeit sollte in diese ersten beiden Ebenen investiert werden. Die Skills, das Loop-Engineering – das ist die Automation, die Kodifizierung, das Memory und der State, richtig? Kannst du jedes Mal dieselben Dinge mit Claude Code tun? Kannst du konsistent sein? Und können wir diese Dinge protokollieren und im Grunde das zweite Gehirn für Claude Code erschaffen, das es nicht nur referenzieren, sondern nutzen kann, um zu verbessern, was

**(30:53)** es bereits tut. Wenn du das hinbekommst, wirst du der Allgemeinheit bei der Nutzung dieses Tools weit voraus sein. Und damit lasse ich dich für das heutige Video. Ich hoffe, das Aufschlüsseln des AIOS und dieser vier Ebenen hat es ein bisschen klarer gemacht, wie diese Dinge funktionieren, wo der Wert liegt und wie du selbst so etwas erschaffen kannst.

**(31:12)** Wie ich vorhin erwähnt habe: Wenn du meine genauen Setups willst, findest du das alles in Chase AI Plus.

---

*Übersetzung des selbst bereitgestellten Transkripts. „Cloud Code"/„clawed code" im Original bezeichnen durchgängig **Claude Code** (Spracherkennungsfehler der automatischen Untertitel).*
