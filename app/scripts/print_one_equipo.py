import asyncio
from bson import json_util
from app.core.database import equipos_collection

async def run():
    doc = await equipos_collection.find_one({})
    if doc is None:
        print('No documents found in equipos collection')
        return
    print(json_util.dumps(doc, default=str, indent=2))

if __name__ == '__main__':
    asyncio.run(run())
