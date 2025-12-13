from required import *
import mysql.connector
def fetch_worker_add_info(ID):
    db = mysql.connector.connect(
         host="localhost",
         user="root",
         password="",
         database="safetronics"
          ) 
    cursor = db.cursor(dictionary=True)
    worker_id = ID
    sql="SELECT * FROM workers WHERE id = %s"

    # execute query
    cursor.execute(sql, (worker_id,))

    # Fetch the result
    worker = cursor.fetchone()
    if worker:
      db.close()
      return worker
    else:
      db.close()
      return None
    
if __name__=="__main__":
   info = fetch_worker_add_info(1)
   print(info)
