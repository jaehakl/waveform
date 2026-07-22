import hashlib

import pytest

from db import Experiment, Structure
from settings import settings
from tests.helpers import auth_headers, create_user


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def save_payload(code: str, semantic_hash: str, **extra):
    return {
        "name": "Saved definition",
        "description": "description",
        "code": code,
        "rawCodeHash": code_hash(code),
        "semanticHash": semantic_hash,
        "semanticHashVersion": 1,
        **extra,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(("path", "model"), (("structure", Structure), ("experiment", Experiment)))
async def test_save_updates_minor_changes_and_forks_structural_changes(
    client,
    db_session,
    monkeypatch,
    path,
    model,
):
    monkeypatch.setattr(settings, "JWT_SECRET", "test-jwt-secret-at-least-32-bytes-long")
    owner = await create_user(db_session)
    headers = auth_headers(owner)
    first_code = "export default 1;"
    created = await client.post(
        f"/{path}/save",
        headers=headers,
        json=save_payload(first_code, "1" * 64),
    )
    assert created.status_code == 200
    assert created.json()["action"] == "created"
    entity_id = created.json()["id"]

    formatted_code = "export default 1\n"
    updated = await client.post(
        f"/{path}/save",
        headers=headers,
        json=save_payload(
            formatted_code,
            "1" * 64,
            id=entity_id,
            baseRawCodeHash=code_hash(first_code),
            baseSemanticHash="1" * 64,
        ),
    )
    assert updated.status_code == 200
    assert updated.json() == {"id": entity_id, "action": "updated", "parentId": None}
    assert (await db_session.get(model, entity_id)).code == formatted_code

    changed_code = "export default 2;"
    forked = await client.post(
        f"/{path}/save",
        headers=headers,
        json=save_payload(
            changed_code,
            "2" * 64,
            id=entity_id,
            baseRawCodeHash=code_hash(formatted_code),
            baseSemanticHash="1" * 64,
        ),
    )
    assert forked.status_code == 200
    assert forked.json()["action"] == "forked"
    child = await db_session.get(model, forked.json()["id"])
    assert child.parent_id == entity_id
    assert child.user_id == owner.id
    assert (await db_session.get(model, entity_id)).code == formatted_code

    grandchild_code = "export default 3;"
    grandchild = await client.post(
        f"/{path}/save",
        headers=headers,
        json=save_payload(
            grandchild_code,
            "3" * 64,
            id=child.id,
            baseRawCodeHash=code_hash(changed_code),
            baseSemanticHash="2" * 64,
        ),
    )
    assert grandchild.status_code == 200
    grandchild_entity = await db_session.get(model, grandchild.json()["id"])
    assert grandchild_entity.parent_id == child.id


@pytest.mark.asyncio
async def test_generic_upsert_rejects_code_changes_and_save_rejects_stale_hash(
    client,
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(settings, "JWT_SECRET", "test-jwt-secret-at-least-32-bytes-long")
    owner = await create_user(db_session)
    headers = auth_headers(owner)
    entity = Structure(name="Existing", code="old", user_id=owner.id)
    db_session.add(entity)
    await db_session.commit()

    generic = await client.post("/structure/upsert", headers=headers, json=[{
        "id": entity.id,
        "name": entity.name,
        "code": "new",
    }])
    assert generic.status_code == 409

    metadata_only = await client.post("/structure/upsert", headers=headers, json=[{
        "id": entity.id,
        "name": "Renamed",
        "description": "metadata only",
        "code": "old",
    }])
    assert metadata_only.status_code == 200
    await db_session.refresh(entity)
    assert entity.name == "Renamed"

    stale = await client.post("/structure/save", headers=headers, json=save_payload(
        "new",
        "2" * 64,
        id=entity.id,
        baseRawCodeHash=code_hash("not old"),
        baseSemanticHash="1" * 64,
    ))
    assert stale.status_code == 409
