from required import *
from push_alerts import push_alerts
from fetch_worker_info import fetch_worker_add_info
from predict_from_data import prediction
from push_to_measurements import push_measurements

class DataProcessor(threading.Thread):
    def __init__(self, queue):
        super().__init__(daemon=True)
        self.queue = queue

    def run(self):
        print("Processor Thread Started")

        while True:
            try:
                payload = self.queue.get()  # normal thread-safe get
                print("\nPROCESSING:")
                print("Payload:", payload)
                print("Type of payload:",type(payload))

                # check for fall or sos alert here
                sos_status = 1 if payload["sosStatus"] == "SOS Alert" else 0
                mpu_status = 1 if payload["mpuStatus"] == "Impact detected" else 0
                print(f"SOS: {sos_status}, MPU: {mpu_status}")

                if sos_status == 1 or mpu_status ==1:
                    data_to_push = {}
                    data_to_push["worker_id"] = payload["ID"]
                    data_to_push["ack"] = 0
                    data_to_push["type"] = "sos" if sos_status==1 else "fall_detected"
                    print("Type of ack: ", type(data_to_push["ack"]))
                    push_alerts(data_to_push)
                    self.queue.task_done()
                    continue

                # Fetch Worker Info

                worker_add_info = fetch_worker_add_info(payload["ID"])
                print("Additional Info Fetch: ", worker_add_info)


                # Prediction
                prediction_result = prediction(payload, worker_add_info)
                print("Predicted Result: ", prediction_result)
                if prediction_result["prediction"] == 0:
                    data_to_push["worker_id"] = payload["ID"]
                    data_to_push["ack"] = 0
                    data_to_push["type"] = "Health"
                    push_alerts(data_to_push)
                print("Predicted Result: ", prediction_result)

                # DB Push
                push_measurements(prediction_result, payload)
                print("Data is pushed successfully to measurements")
                self.queue.task_done()

            except Exception as e:
                print("Processor Error:", e)

            time.sleep(0.1)
