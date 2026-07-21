import threading
import fugashi
import unidic

_jp_local = threading.local()


def _katakana_to_hiragana(value: str):
    return "".join(
        chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char
        for char in value
    )


def get_pron_from_extracted_word(word):
    pron = (
        word.get("kanaBase")
        or word.get("kana")
        or word.get("pronBase")
        or word.get("pron")
        or ""
    )
    return _katakana_to_hiragana(str(pron).strip()) if pron else ""


def get_pron_by_lemma_id(lemma_id: int | None, lemma: str):
    if lemma_id is None or not lemma:
        return ""

    _, words_dict = extract_jp_words_from_text(lemma)
    word = words_dict.get(lemma_id)
    if not word:
        return ""

    return get_pron_from_extracted_word(word)


def format_lemma_with_pron(lemma_id: int | None, lemma: str):
    lemma = lemma.strip()
    pron = get_pron_by_lemma_id(lemma_id, lemma)
    if not pron or pron == lemma:
        return lemma
    return f"{lemma}（{pron}）"


def extract_jp_words_from_text(text: str):
    if not hasattr(_jp_local, "tagger"):
        _jp_local.tagger = fugashi.Tagger('-d "{}"'.format(unidic.DICDIR))
    tagger = _jp_local.tagger

    document = []
    words_dict = {}
    if text is None:
        return document, words_dict
    text_list = text.split("\n")
    for line_text in text_list:
        line = []
        line_words = tagger(line_text)
        for word in line_words:
            feat = word.feature            
            lemma_id = int(getattr(feat, "lemma_id", None)) if getattr(feat, "lemma_id", None) else None
            line.append({                
                "surface": word.surface,
                "lemma_id": lemma_id,
            })
            if lemma_id not in words_dict:                
                words_dict[lemma_id] = {
                    "lemma_id": lemma_id,
                    "lemma": getattr(feat, "lemma", None),
                    "pos1": getattr(feat, "pos1", None),
                    "pos2": getattr(feat, "pos2", None),
                    "pos3": getattr(feat, "pos3", None),
                    "pos4": getattr(feat, "pos4", None),
                    "cType": getattr(feat, "cType", None),
                    "cForm": getattr(feat, "cForm", None),
                    "lForm": getattr(feat, "lForm", None),
                    "orth": getattr(feat, "orth", None),
                    "pron": getattr(feat, "pron", None),
                    "orthBase": getattr(feat, "orthBase", None),
                    "pronBase": getattr(feat, "pronBase", None),
                    "goshu": getattr(feat, "goshu", None),
                    "iType": getattr(feat, "iType", None),
                    "iForm": getattr(feat, "iForm", None),
                    "fType": getattr(feat, "fType", None),
                    "fForm": getattr(feat, "fForm", None),
                    "iConType": getattr(feat, "iConType", None),
                    "fConType": getattr(feat, "fConType", None),
                    "type": getattr(feat, "type", None),
                    "kana": getattr(feat, "kana", None),
                    "kanaBase": getattr(feat, "kanaBase", None),
                    "form": getattr(feat, "form", None),
                    "formBase": getattr(feat, "formBase", None),
                    "aType": getattr(feat, "aType", None),
                    "aConType": getattr(feat, "aConType", None),
                    "aModType": getattr(feat, "aModType", None),
                    "lid": getattr(feat, "lid", None),
                }
        document.append(line)
        
    return document, words_dict
