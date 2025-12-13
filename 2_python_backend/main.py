
from required import *
ESP32_MAC = "F4:65:0B:49:8F:66"
CHAR_UUID = "5678"

async def main():
    data_queue = queue.Queue()  # Thread-safe queue for BLE -> processor

    # Start processor thread
    processor = DataProcessor(data_queue)
    processor.start()

    # Start BLE listener
    ble_client = BLEClient(ESP32_MAC, CHAR_UUID, data_queue)
    await ble_client.connect_and_listen()

if __name__ == "__main__":
    asyncio.run(main())
