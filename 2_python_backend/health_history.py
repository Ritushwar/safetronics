import mysql.connector
from datetime import datetime
# connect to local databse
def push_health_hostory():
    db = mysql.connector.connect(
        host = 'localhost',
        user = 'root',
        password = '',
        database='safetronics'
    )

    cursor = db.cursor(dictionary=True)
    now = datetime.now()
    sql = """INSERT INTO health_history (worker_id,date,
                                         min_temp, max_temp, avg_temp,
                                         min_pulse, max_pulse, avg_pulse,
                                         min_spo2, max_spo2, avg_spo2,
                                         sos_count, fall_count, risk_count,
                                         health_status
                                         )
                                          SELECT
                                            m.worker_id,
                                            m.day,
                                            m.min_temp,
                                            m.max_temp,
                                            m.avg_temp,
                                            m.min_pulse,
                                            m.max_pulse,
                                            m.avg_pulse,
                                            m.min_spo2,
                                            m.max_spo2,
                                            m.avg_spo2,
                                            IFNULL(a.sos_count, 0) AS sos_count,
                                            IFNULL(a.fall_count, 0) AS fall_count,
                                            IFNULL(a.risk_count, 0) AS risk_count,
                                            IF(IFNULL(a.risk_count,0) < 2, 'good', 'risk') AS health_status
                                        FROM
                                        (
                                            SELECT
                                            worker_id,
                                            DATE(createdAt) as day,
                                            MIN(body_temp) as min_temp,
                                            MAX(body_temp) as max_temp,
                                            ROUND(AVG(body_temp),2) as avg_temp,
                                            MIN(pulse_rate) as min_pulse,
                                            MAX(pulse_rate) as max_pulse,
                                            ROUND(AVG(pulse_rate),2) as avg_pulse,
                                            MIN(spo2) as min_spo2,
                                            MAX(spo2) as max_spo2,
                                            ROUND(AVG(spo2),2) as avg_spo2
                                        FROM measurements
                                        WHERE DATE(createdAT) = CURDATE()
                                        GROUP BY worker_id, day
                                    ) as m
                                    LEFT JOIN
                                    (
                                        SELECT
                                            worker_id,
                                            DATE(createdAt) AS day,
                                            SUM(CASE WHEN type = 'sos' THEN 1 ELSE 0 END) AS sos_count,
                                            SUM(CASE WHEN type = 'fall_detected' THEN 1 ELSE 0 END) AS fall_count,
                                            SUM(CASE WHEN type = 'Health' THEN 1 ELSE 0 END) AS risk_count
                                        FROM alerts
                                        WHERE DATE(createdAt) = CURDATE()
                                        GROUP BY worker_id, day
                                    ) AS a
                                    ON m.worker_id = a.worker_id AND m.day = a.day; 
                                    """
    cursor.execute(sql)
    db.commit()
    db.close()
    return now

if __name__ == "__main__":
    now = push_health_hostory()
    print("Data Updated at:", now)