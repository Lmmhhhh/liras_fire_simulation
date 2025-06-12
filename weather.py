# API 호출을 위한 모듈을 불러옴
from urllib.request import urlopen

# 변수 선언
domain = "https://apihub.kma.go.kr/api/typ01/url/kma_sfctm3.php?tm1=201512110100&tm2=201512140000&stn=108&help=1&authKey=xwx2vQPjQMqMdr0D40DKHg"
tm1 = "20250501"
tm2 = "20250510"
stn = "stn=104&"
help = 1
authKey = "xwx2vQPjQMqMdr0D40DKHg"

url = domain + tm1 +tm2 + stn + help+ authKey

# 타는 이름으로 url 호출
with urlopen(url) as f:
    html = f.read()
    print(html)