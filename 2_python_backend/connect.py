from required import *

class BLEClient:
    def __init__(self, mac, char_uuid, queue):
        self.mac = mac
        self.char_uuid = char_uuid
        self.queue = queue

    async def _handler(self, sender, data):
        try:
            decoded = data.decode()
            payload = json.loads(decoded)
            print(f"\nBLE Incoming: {payload}")

            # thread-safe put
            loop = asyncio.get_event_loop()
            loop.call_soon_threadsafe(self.queue.put, payload)

        except Exception as e:
            print("BLE Parsing Error:", e)

    async def connect_and_listen(self):
        while True:
            try:
                print("\nAttempting BLE Connection...")
                async with BleakClient(self.mac) as client:
                    print("BLE Connected!")
                    await client.start_notify(self.char_uuid, self._handler)
                    print("Listening for notifications...\n")

                    while client.is_connected:
                        await asyncio.sleep(1)

            except Exception as e:
                print(f"BLE Error: {e}")

            print("Reconnecting in 3 seconds...")
            await asyncio.sleep(3)
