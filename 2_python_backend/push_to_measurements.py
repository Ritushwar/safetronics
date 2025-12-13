# this module take data from predict module and push the data to database
import mysql.connector
from datetime import datetime
# connect to xampp seerver
def push_measurements(predicated_data, received_data):
    conn = mysql.connector.connect(
           host="localhost",
           user="root",            # default for XAMPP
           password="",            # xampp mysql has no password by default
           database="safetronics"
            )

    cursor = conn.cursor()
    now = datetime.now()
    # insert sample data
    data = [
             (predicated_data["worker_ID"], received_data["bodyTemp"],received_data["heartRate"],received_data["spo2"],0.067,predicated_data["prediction"],predicated_data["probability"],now, now)
            ]

    cursor.executemany("INSERT INTO measurements (worker_id, body_temp, pulse_rate, spo2, hrv, prediction, probability, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", data)

    conn.commit()
    conn.close()

    print("Data inserted successfully! ")
if __name__ == "__main__":
        predicated_data = {"worker_ID": 1, "prediction":1, "probability":0.8967 }
        received_data = {"bodyTemp":30.8, "heartRate": 70, "spo2": 89.35}
        push_measurements(predicated_data, received_data)
        print("Data Inserted Success")