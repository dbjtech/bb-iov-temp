const request = require('request')
const R = require('ramda')
const Koa = require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')
const http = require('http')

const app = new Koa()
const router = new Router()

const rq = request.defaults({ jar: true })

const config = {
	server: 'http://bigbrother.dbjtech.com',
	username: process.env.user,
	password: process.env.password,
}

function fetch(method, uri, params) {
	return new Promise((resolve, reject) => {
		const options = { uri: `${config.server}/${uri}`, method, json: true }
		if (method === 'GET') {
			options.qs = params
		} else {
			options.body = params
		}
		rq(options, (err, rs) => {
			if (err) {
				reject(err)
			} else {
				resolve(rs.body)
			}
		})
	})
}

const toSeries = R.pipe(
	R.filter(e => e.indexOf('voltage') !== -1),
	R.map(e => (/\[D (\d{2})(\d{2})(\d{2})(.{9})[^\]]*\].*"voltage":(\d*).*\[(.*)\]/g).exec(e)),
	R.filter(e => !!e),
	R.groupBy(R.prop(6)),
	R.map(R.map(e => [`20${e[1]}-${e[2]}-${e[3]}${e[4]}`, e[5]])),
	R.toPairs,
	R.map(([name, data]) => ({
		name: name.replace(/<\/?em>/g, ''),
		type: 'scatter',
		data,
	}))
)

async function getLogs({ query = 'Logger', days = 1, limit = 10000 }) {
	const loginRes = await fetch('POST', 'api/login', { username: config.username, password: config.password })
	// console.log(loginRes)
	const now = Math.floor(Date.now() / 1000)
	const queryRes = await fetch('GET', 'api/logs', {
		keyword: query,
		time_start: now - days * 24 * 3600,
		time_end: now,
		offset: 0,
		limit,
	})
	// console.log(queryRes)
	return toSeries(queryRes.result.rows)
}

const indexHtml = ({ series = [] } = {}) => `
<!DOCTYPE html>
<html>
<head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.1.2/dist/css/bootstrap.min.css">
	<script src="https://cdn.jsdelivr.net/npm/echarts@4.4.0/dist/echarts.min.js"></script>
	<script type="text/javascript">
		window.onload = function() {
			// based on prepared DOM, initialize echarts instance
			var myChart = echarts.init(document.getElementById('main'));
		
			// specify chart configuration item and data
			var option = {
				legend: { type: 'plain' },
				xAxis: { type: 'category' },
				yAxis: {},
				dataZoom: [{
					type: 'slider',
					show: true,
				}],
				series: ${JSON.stringify(series)},
			};
		
			// use configuration item and data specified to show chart
			myChart.setOption(option);
			window.onresize = function() { myChart.resize({ width: 'auto' }) }
		}
	</script>
</head>
<body style="color: gray; font-size: 1.2em;">
	<div style="margin: 20px 100px;">
		<div class="row" style="font-family: Segoe UI Emoji; font-size: 3em; color: transparent; text-shadow: 0 0 0 lightblue;">
			<span style="margin: 0px auto;">🚧 BB-IOV-TEMP</span>
		</div>
		<form action="/" method="POST" class="form">
			<div class="form-group">
				<div class="input-group">
					<input type="text" name="query" placeholder="SN or empty for all" class="form-control">
					<div class="input-group-append">
						<input type="submit" value="Submit" class="btn btn-primary">
					</div>
				</div>
			</div>
			<div id="main" style="width: 100%; height:600px; margin: auto;"></div>
			</div>
		</form>
	</div>
</body>
</html>
`

router.get('/', async (ctx) => {
	ctx.body = indexHtml()
})
router.post('/', async (ctx) => {
	const data = Object.assign(ctx.request.query, ctx.request.body)
	console.log(new Date(), ctx.method, JSON.stringify(data))
	ctx.body = indexHtml({ series: await getLogs(data) })
})
app.use(koaBody())
app.use(router.routes())
app.use(router.allowedMethods())

const server = http.createServer(app.callback())
server.listen(80)
