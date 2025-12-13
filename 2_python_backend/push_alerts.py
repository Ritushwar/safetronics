# this module take data from predict module and push the data to database

# connect to xampp seerver
from required import *
from datetime import datetime
import mysql.connector
def push_alerts(data_to_push):
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
             (data_to_push["worker_id"], data_to_push["ack"],data_to_push["type"],now, now)
            ]
    cursor.executemany("INSERT INTO alerts (worker_id, acknowledged, type, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s)", data)

    conn.commit()
    conn.close()

    print("Data inserted into alerts table successfully!")