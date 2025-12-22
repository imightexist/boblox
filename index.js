let pkg = {
    express:require('express'),
    http:require('http'),
    ws:require('ws'),
    jsdom:require('jsdom'),
    fs:require('fs'),
    crypto:require('crypto'),
    path:require('path'),
    cookie:require('cookie-parser'),
    nocache:require('nocache'),
    noblox:require('noblox.js'),
    badWords:require('naughty-words/en.json'),
    obscenity:require('obscenity'),
    cuss:require('cuss'),
    xml:require('xml2js')
}
let express = pkg.express()
let http = pkg.http.createServer()
let ws = new pkg.ws.Server({server:http,pingInterval:30000,pongTimeout:10000})
let config = require('./config.json')
let data = require("./data.json")
let sitemaps = {}
let xml = new pkg.xml.Builder()
pkg.xml.parseString(pkg.fs.readFileSync("sitemaps/profile.xml").toString(),function(e,res){
    sitemaps.profile=res
})
sitemaps.save=function(a){
    pkg.fs.writeFileSync("sitemaps/"+a+".xml",xml.buildObject(sitemaps[a]))
}
//let badWords = new pkg.badWords({data:pkg.badWordsEn})
pkg.badWords.forEach(function(e,i){
    pkg.badWords[i]=e.replaceAll(" ","")
})
let obscenity = new pkg.obscenity.RegExpMatcher({...pkg.obscenity.englishDataset.build(),...pkg.obscenity.englishRecommendedTransformers})
let memory = config.memory

//pkg.noblox.setCookie(config.cookie).then(function(e){log("ROBLOX cookie success "+JSON.stringify(e))}).catch(function(e){})
ws.on('connection',function(con){
    // for chat functionality
    con.on('message',function(msg){
        try{
            msg = JSON.parse(msg.toString())
            log("WS "+JSON.stringify(msg))
            if (msg.type=="admin"){
                if (Object.keys(memory.admins).includes(msg.token)){
                    if (memory.admins[msg.token]=="open"){
                        memory.admins[msg.token]=con
                        con.once('close',function(){
                            delete memory.admins[msg.token]
                        })
                    }else{
                        con.close()
                    }
                }
            }else if (msg.type=="eval"){
                if (Object.values(memory.admins).includes(con)){
                    con.send(JSON.stringify({type:"eval",result:eval(msg.text)}))
                }
            }
        }catch(e){
            con.close(1011)
        }
    })
})
function log(a){
    console.log(a)
    Object.values(memory.admins).forEach(function(b){
        //console.log(b)
        if (b != "open"){
            try{
                b.send(JSON.stringify({type:"log",text:a}))
            }catch(e){}
        }
    })
}
express.use(pkg.nocache())
express.use(pkg.express.json())
express.use(pkg.cookie())
function save(){
    pkg.fs.writeFileSync("data.json",JSON.stringify(data),"utf-8")
}
function nFixed(x,y){
    return (Math.floor(x*Math.pow(10,y))/Math.pow(10,y)).toString()
}
function nFormatter(num) {
    const lookup = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "K+" },
        { value: 1e6, symbol: "M+" },
        { value: 1e9, symbol: "B+" },
        { value: 1e12, symbol: "T+" }
    ];
    const regexp = /\.0+$|(?<=\.[0-9]*[1-9])0+$/;
    const item = lookup.findLast(item => num >= item.value);
    let product = item ? nFixed(num / item.value,1).replace(regexp, "").concat(item.symbol): "0"
    if (product.length>5){
        return item ? nFixed(num / item.value,0).replace(regexp, "").concat(item.symbol) : "0";
    }else{
        return product
    }
}
function template(req){
    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/template.html").toString())
    if (req.path != "/"){
        doc.window.document.querySelector(".rbx-navbar-signup").href+="?returnUrl="+encodeURI(req.path)
        //doc.window.document.getElementById("iframe-login").src+="?returnUrl="+encodeURI(req.path)
    }
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            doc.window.document.getElementById("nav-logged-in").style.display="flex"
            doc.window.document.querySelector(".navbar-brand").href="/home"
            doc.window.document.getElementById("login").style.display="none"
            doc.window.document.getElementById("nav-menu").parentElement.style.display="inline-block"
            doc.window.document.getElementById("robux").innerHTML=nFormatter(data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].robux)
            doc.window.document.getElementById("tix").innerHTML=nFormatter(data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].tix)
            doc.window.document.getElementById("tix-count").innerHTML=Intl.NumberFormat().format(data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].tix)+" Tickets"
            doc.window.document.getElementById("robux-count").innerHTML=Intl.NumberFormat().format(data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].robux)+" BOBUX"
            doc.window.document.getElementById("signup").style.display="none"
            doc.window.document.body.innerHTML+=pkg.fs.readFileSync("app/sidebar.html").toString()
            doc.window.document.getElementById("sidebar-username").innerHTML=data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].usernames[0]
            doc.window.document.body.innerHTML+=pkg.fs.readFileSync("app/chat.html").toString()
            doc.window.document.getElementById("sidebar-profile").href="/users/"+data.sessions[req.cookies[".BOBLOSECURITY"]]+"/profile"
            //doc.window.document.getElementById("sidebar-username").parentElement.href="/users/"+data.sessions[req.cookies[".BOBLOSECURITY"]]+"/profile"
        }
    }
    doc.window.document.body.innerHTML+=pkg.fs.readFileSync("app/history.html").toString()
    /*if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Ob)
    }*/
    return doc
}
//express.set('trust proxy','0.0.0.0')
express.use(function(err,req,res,next){
    res.status(500)
    res.end()
})
express.use('*\w',function(req,res,next){
    //log(req.headers)
    log(req.method+" "+decodeURIComponent(req.originalUrl))
    let banned = false
    if (Object.keys(req.headers).includes("cf-connecting-ip")){
        banned=data.bannedIPs.includes(pkg.crypto.pbkdf2Sync(req.headers["cf-connecting-ip"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding))
    }else if (Object.keys(req.headers).includes("x-forwarded-for")){
        banned=data.bannedIPs.includes(pkg.crypto.pbkdf2Sync(req.headers["x-forwarded-for"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding))
    }
    if ((req.originalUrl.startsWith("/ipban")||banned)&&!req.originalUrl.startsWith("/static/")){
        if (req.method=="GET"){
            //log("GET "+path)
            if (Object.keys(req.query).includes("contentOnly")){
                if (req.query.contentOnly=="true"){
                    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/404.html").toString())
                    doc.window.document.title="BOBLOX.collabai.lol"
                    doc.window.document.getElementById("messageHeader").innerHTML="Access Denied"
                    //log(doc.window.document.getElementById("messageHeader").innerHTML)
                    doc.window.document.getElementById("message").innerHTML="403 | Our content monitors have determined that your behavior at BOBLOX has been in violation of our Terms of Service.<br><br>Your IP has been blacklisted.<br><br>If you wish to appeal, please contact us via <a href=\"https://discord.gg/PtEPwUP8qG\" target=\"_blank\" style=\"font-weight:300\" class=\"text-name\">Discord</a>."
                    doc.window.document.querySelector(".action-buttons").style.display="none"
                    doc.window.document.getElementById("errorImage").src="/static/403.png"
                    res.send(doc.serialize()).status(403).end()
                    //res.status(403)
                    //res.end()
                    return
                }
            }
            if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
                if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
                    delete data.sessions[req.cookies[".BOBLOSECURITY"]]
                    save()
                }
            }
            let doc = template(req)
            doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/404.html").toString()
            doc.window.document.title="BOBLOX.collabai.lol"
            doc.window.document.getElementById("messageHeader").innerHTML="Access Denied"
            doc.window.document.getElementById("message").innerHTML="403 | Our content monitors have determined that your behavior at BOBLOX has been in violation of our Terms of Service.<br><br>Your IP has been blacklisted.<br><br>If you wish to appeal, please contact us via <a href=\"https://discord.gg/PtEPwUP8qG\" target=\"_blank\" style=\"font-weight:300\" class=\"text-name\">Discord</a>."
            //doc.window.document.getElementById("errorImage").src="data:image/png;base64,"+pkg.fs.readFileSync("static/404.png").toString("base64")
            /*let stylesheet = doc.window.document.createElement("style")
            stylesheet.innerHTML = pkg.fs.readFileSync("static/leanbase.css")
            doc.window.document.head.appendChild(stylesheet)
            stylesheet = doc.window.document.createElement("style")
            stylesheet.innerHTML = pkg.fs.readFileSync("static/banner-styles.css")
            doc.window.document.head.appendChild(stylesheet)
            stylesheet = doc.window.document.createElement("style")
            stylesheet.innerHTML = pkg.fs.readFileSync("static/main.css")
            doc.window.document.head.appendChild(stylesheet)
            stylesheet = doc.window.document.createElement("style")
            stylesheet.innerHTML = pkg.fs.readFileSync("static/robux.css")
            doc.window.document.head.appendChild(stylesheet)
            delete stylesheet*/
            doc.window.document.querySelector(".action-buttons").style.display="none"
            doc.window.document.getElementById("errorImage").src="/static/403.png"
            res.send(doc.serialize())
        }
        res.status(403)
        res.end()
    }else{
        next()
    }
})
express.post('/api/signup',function(req,res){
    let path = decodeURIComponent(req.path)
    if (typeof req.body !== 'object' || req.body === null){
        //log("POST "+path+" 400")
        res.status(400)
        res.end()
        return
    }
    //log("POST "+path+" "+JSON.stringify(req.body))
    //log(req.body)
    let keys = Object.keys(req.body)
    if (keys.includes("username")&&keys.includes("password")&&keys.includes("female")){
        if (typeof req.body.username != "string"||typeof req.body.password !="string"){
            res.status(400).end()
            return
        }
        if (req.body.password.length<config.minPassLen||req.body.password.length>config.maxPassLen||req.body.username.search(/[^\w]/g)!=-1||req.body.username.startsWith("_")||req.body.username.endsWith("_")||req.body.password==req.body.username){
            res.status(400)
        }/*else if (pkg.badWords.find(function(a){return req.query.username.toLowerCase().includes(a)})!=undefined||Object.keys(pkg.cuss.cuss).find(function(a){return req.query.username.toLowerCase().includes(a)&&pkg.cuss.cuss[a]==2})!=undefined)*/else if (config.badWords.find(function(a){return req.body.username.toLowerCase().includes(a)})!=undefined||obscenity.hasMatch(req.body.username.toLowerCase())){
            res.status(406)
        }else if (data.usedUsernames.includes(req.body["username"].toLowerCase())){
            res.status(409)
        }else{
            try{
                if (keys.includes("referrer")){
                    if (typeof req.body.referrer != "string"){
                        res.status(400).end()
                        return
                    }
                    if (Object.keys(data.id).includes(req.body.referrer.toLowerCase())){
                        data.users[data.id[req.body.referrer.toLowerCase()]].tix+=2
                    }else{
                        res.status(404)
                        res.end()
                        return
                    }
                }
                let user = structuredClone(config.user)
                user.password = {}
                user.password.salt = Math.random().toString()
                user.password.iterations=config.iterations
                user.password.digest=config.digest
                user.password.encoding=config.encoding
                user.password.keylen=Math.max(config.keylen,req.body.password.length+user.password.salt.length)
                user.password.key = pkg.crypto.pbkdf2Sync(req.body.password,user.password.salt,user.password.iterations,user.password.keylen,user.password.digest).toString(user.password.encoding)
                user.female=req.body.female
                user.created=new Date().toString()
                user.lastTixStipend=user.created
                user.usernames=[req.body.username]
                if (Object.keys(req.headers).includes("cf-connecting-ip")){
                    user.IPs.push(pkg.crypto.pbkdf2Sync(req.headers["cf-connecting-ip"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding))
                }else if (Object.keys(req.headers).includes("x-forwarded-for")){
                    user.IPs.push(pkg.crypto.pbkdf2Sync(req.headers["x-forwarded-for"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding))
                }
                //data.users.push(user)
                let id = data.users.length
                data.users[id]=user
                data.usedUsernames.push(req.body.username.toLowerCase())
                data.id[req.body.username.toLowerCase()]=id
                //let token = btoa(Math.random().toString()+Math.random().toString())
                let token = pkg.crypto.randomUUID()
                data.sessions[token]=data.id[req.body.username.toLowerCase()]
                sitemaps.profile.urlset.url.push({loc:"https://boblox.collabai.lol/users/"+data.id[req.body.username.toLowerCase()].toString()+"/profile"})
                sitemaps.save("profile")
                save()
                res.cookie(".BOBLOSECURITY",token)
                res.status(201)
            }catch(e){
                log(e)
                res.status(500)
            }
        }
    }else{
        res.status(400)
    }
    // year calculator: Math.floor((new Date()-new Date("01/01/2011"))/31536000000)
    res.end()
})
express.post("/api/logout",function(req,res){
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            delete data.sessions[req.cookies[".BOBLOSECURITY"]]
            save()
            res.status(200)
            res.end()
            return
        }
    }
    res.status(401)
    res.end()
})
express.post('/api/login',function(req,res){
    let path = decodeURIComponent(req.path)
    if (typeof req.body !== 'object' || req.body === null){
        //log("POST "+path+" 400")
        //log('asdfasdfasdf')
        res.status(400)
        res.end()
        return
    }
    //log("POST "+path+" "+JSON.stringify(req.body))
    let keys = Object.keys(req.body)
    if (keys.includes("username")&&keys.includes("password")){
        //log('asdfasdfdsf')
        if (typeof req.body.username != "string"||typeof req.body.password !="string"){
            res.status(400).end()
            return
        }
        if (req.body.password.length<config.minPassLen||req.body.password.length>config.maxPassLen||req.body.username.search(/[^\w]/g)!=-1||req.body.username.startsWith("_")||req.body.username.endsWith("_")||req.body.password==req.body.username){
            res.status(400)
        }else if (!Object.keys(data.id).includes(req.body["username"].toLowerCase())){
            res.status(401)
        }else{
            try{
                let id = data.id[req.body.username.toLowerCase()]
                //log(data.users[id])
                if (data.users[id].password.key!=pkg.crypto.pbkdf2Sync(req.body.password,data.users[id].password.salt,data.users[id].password.iterations,data.users[id].password.keylen,data.users[id].password.digest).toString(data.users[id].password.encoding)){
                    res.status(401)
                    res.end()
                    return
                }
                if (Object.keys(req.headers).includes("cf-connecting-ip")){
                    let ip = pkg.crypto.pbkdf2Sync(req.headers["cf-connecting-ip"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding)
                    if (!data.users[id].IPs.includes(ip)){
                        data.users[id].IPs.push(ip)
                    }
                    //delete ip
                }else if (Object.keys(req.headers).includes("x-forwarded-for")){
                    let ip = pkg.crypto.pbkdf2Sync(req.headers["x-forwarded-for"],config.salt,config.iterations,config.keylen,config.digest).toString(config.encoding)
                    if (!data.users[id].IPs.includes(ip)){
                        data.users[id].IPs.push(ip)
                    }
                    //delete ip
                }
                let token = pkg.crypto.randomUUID()
                data.sessions[token]=data.id[req.body.username.toLowerCase()]
                save()
                res.cookie(".BOBLOSECURITY",token)
                res.status(200)
            }catch(e){
                log(e)
                res.status(500)
            }
        }
    }else{
        res.status(400)
    }
    // year calculator: Math.floor((new Date()-new Date("01/01/2011"))/31536000000)
    res.end()
})
express.get("/api/checkUsername",function(req,res){
    let path = decodeURIComponent(req.path)
    let keys = Object.keys(req.query)
    if (keys.includes("username")){
        if (typeof req.query.username != "string"){
            res.status(400).end()
            return
        }
        //log(req.query.username.toLowerCase())
        if (req.query.username.length<3||req.query.username.length>20||req.query.username.search(/[^\w]/g)!=-1||req.query.username.startsWith("_")||req.query.username.endsWith("_")){
            res.status(400)
        }else if (config.badWords.find(function(a){return req.query.username.toLowerCase().includes(a)})!=undefined||obscenity.hasMatch(req.query.username.toLowerCase())){
            res.status(406)
        }else if (data.usedUsernames.includes(req.query.username.toLowerCase())){
            res.status(409)
        }else{
            /*pkg.noblox.getGeneralToken(pkg.noblox.jar()).then(function(xcsrf){
                fetch("https://auth.roblox.com/v2/usernames/validate",{headers:{"X-Csrf-Token":xcsrf},method:"POST",body:JSON.stringify({username:req.query.username,context:"Signup",birthday:"2000-07-19T05:00:00.000Z"})}).then(function(res2){
                    res2.json().then(function(body){
                        log(body)
                        if (res2.status==200&&body.code==2){
                            res.status(406)
                            //res.end()
                            data.badWords.push(req.query.username.toLowerCase())
                            save()
                        }else{
                            if (keys.includes("referrer")){
                                if (Object.keys(data.id).includes(req.query.referrer.toLowerCase())){
                                    res.status(200)
                                }else{
                                    res.status(404)
                                }
                            }else{
                                res.status(200)
                            }
                        }
                        res.end()
                        return
                    }).catch(function(e){})
                }).catch(function(e){})
            }).catch(function(e){})*/
            if (keys.includes("referrer")){
                if (Object.keys(data.id).includes(req.query.referrer.toLowerCase())){
                    res.status(200)
                }else{
                    res.status(404)
                }
            }else{
                res.status(200)
            }
        }
    }else{
        res.status(400)
    }
    res.end()
})
express.post('*\w',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("POST "+path)
    res.status(404)
    res.end()
})
//express.use('/static',pkg.express.static(pkg.path.join(__dirname,'static')))
express.get('/static/*\w',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (pkg.fs.readdirSync("static").includes(path.replace("/static/",""))){
        res.sendFile(pkg.path.join(__dirname,'static',path.replace("/static/","")))
        //res.end()
    }else{
        /*doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/404.html").toString()
        doc.window.document.title="BOBLOX.collabai.lol"*/
        res.status(404)
        res.end()
    }
    //res.end()
})
express.get('/sitemaps/*\w',function(req,res){
    //log(res.statusCode)
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (pkg.fs.readdirSync("sitemaps").includes(path.replace("/sitemaps/",""))){
        res.sendFile(pkg.path.join(__dirname,'sitemaps',path.replace("/sitemaps/","")))
        //res.end()
    }else{
        /*doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/404.html").toString()
        doc.window.document.title="BOBLOX.collabai.lol"*/
        res.status(404)
        //log(res.statusCode)
        res.end()
    }
    //res.end()
})
express.get('/admin/console',function(req,res,next){
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            if (Object.keys(data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]]).includes("admin")){
                if (data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].admin){
                    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/console.html").toString())
                    let token = pkg.crypto.randomUUID()
                    memory.admins[token]="open"
                    doc.window.document.querySelector('meta[name=admin]').setAttribute("content",token)
                    res.send(doc.serialize()).end()
                    return
                }
            }else{
                data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].admin=false
                save()
            }
        }
    }
    res.status(403)
    next()
})
express.get('/game/*\w',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    //log("fuck u bitch fuck fuck fuckkkk")
    if (pkg.fs.readdirSync("Game").includes(path.replace("/game/","").replace("/Game/",""))){
        res.sendFile(pkg.path.join(__dirname,'Game',path.replace("/game/","").replace("/Game/","")))
        //res.end()
    }else{
        /*doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/404.html").toString()
        doc.window.document.title="BOBLOX.collabai.lol"*/
        res.status(404)
        res.end()
    }
    //res.end()
})
express.get('/',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            if (Object.keys(req.query).includes("contentOnly")){
                if (req.query.contentOnly=="true"){
                    //log(req.originalUrl.search)
                    res.redirect("/home?contentOnly=true")
                    return
                }
            }
            //res.redirect("/home"+req.originalUrl.search)
            res.redirect("/home")
            return
        }
    }
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.sendFile(pkg.path.join(__dirname,"app","splash.html"))
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/splash.html").toString()
    doc.window.document.title="BOBLOX.collabai.lol"
    //doc.window.document.getElementById("footer-note").innerHTML += " This page is an exception unless you have already accepted our terms."
    res.send(doc.serialize())
    res.end()
})
/*express.get('/landing',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/splash.html").toString()
    doc.window.document.title="BOBLOX.collabai.lol"
    doc.window.document.getElementById("footer-note").innerHTML += " This page is an exception unless you have already accepted our terms."
    res.send(doc.serialize())
    res.end()
})*/
express.get('/upgrades/robux',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.sendFile(pkg.path.join(__dirname,"app","robux.html"))
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/robux.html").toString()
    doc.window.document.title="BOBUX - BOBLOX"
    res.send(doc.serialize())
    res.end()
})
express.get('/upgrades/premium',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.sendFile(pkg.path.join(__dirname,"app","premium.html"))
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/premium.html").toString()
    doc.window.document.title="Upgrade - BOBLOX"
    res.send(doc.serialize())
    res.end()
})
express.get('/develop',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.sendFile(pkg.path.join(__dirname,"app","develop.html"))
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/develop.html").toString()
    doc.window.document.title="Develop - BOBLOX"
    res.send(doc.serialize())
    res.end()
})
express.get('/games',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            //res.sendFile(pkg.path.join(__dirname,"app","games.html"))
            let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/games.html").toString())
            if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
                if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
                    doc.window.document.querySelector(".content").classList.add("container-has-sidebar")
                }
            }
            res.send(doc.serialize())
            res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/games.html").toString()
    doc.window.document.title="Games - BOBLOX"
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            doc.window.document.querySelector(".content").classList.add("container-has-sidebar")
        }
    }
    res.send(doc.serialize())
    res.end()
})
express.get('/catalog',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.sendFile(pkg.path.join(__dirname,"app","catalog.html"))
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/catalog.html").toString()
    doc.window.document.title="Catalog - BOBLOX"
    res.send(doc.serialize())
    res.end()
})
express.get('/info/terms-of-service',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    res.redirect("/static/terms.txt")
    res.end()
    return
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/terms.html").toString()
    doc.window.document.title="BOBLOX Terms of Service"
    //doc.window.document.getElementById("footer-note").innerHTML += " This page is an exception unless you have already accepted our terms."
    res.send(doc.serialize())
    res.end()
})
express.get('/info/api',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    res.redirect("/static/api.txt")
    res.end()
})
express.get('/web',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    let doc = template(req)
    res.send(doc.serialize())
    res.end()
})
express.get('/web/place',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/place.html").toString())
            res.send(doc.serialize()).end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML=pkg.fs.readFileSync("app/place.html").toString()
    res.send(doc.serialize())
    res.end()
})
express.get('/groups/create',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            if (Object.keys(req.query).includes("contentOnly")){
                if (req.query.contentOnly=="true"){
                    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/group create.html").toString())
                    res.send(doc.serialize()).end()
                    return
                }
            }
            let doc = template(req)
            doc.window.document.getElementById("content").innerHTML=pkg.fs.readFileSync("app/group create.html").toString()
            res.send(doc.serialize())
            res.end()
            return
        }
    }
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            res.redirect('/?returnUrl=%2Fgroups%2Fcreate&contentOnly=true')
            return
        }
    }
    res.redirect('/?returnUrl=%2Fgroups%2Fcreate')
})
express.get('/info/terms',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    res.redirect("/info/terms-of-service")
    res.end()
})
express.get('/info/privacy',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    res.redirect("/static/privacy.txt")
    res.end()
})
express.get('/home',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            if (Object.keys(req.query).includes("contentOnly")){
                if (req.query.contentOnly=="true"){
                    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/home.html").toString())
                    doc.window.document.getElementById("content-username").innerHTML="Hello, "+data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].usernames[0]+"!"
                    doc.window.document.getElementById("content-avatar").parentElement.href="/users/"+data.sessions[req.cookies[".BOBLOSECURITY"]]+"/profile"
                    res.send(doc.serialize())
                    //res.end()
                    return
                }
            }
            let doc = template(req)
            doc.window.document.title="Home - BOBLOX"
            doc.window.document.getElementById("content").innerHTML=pkg.fs.readFileSync("app/home.html").toString()
            doc.window.document.getElementById("content-username").innerHTML="Hello, "+data.users[data.sessions[req.cookies[".BOBLOSECURITY"]]].usernames[0]+"!"
            doc.window.document.getElementById("content-avatar").parentElement.href="/users/"+data.sessions[req.cookies[".BOBLOSECURITY"]]+"/profile"
            res.send(doc.serialize())
            res.end()
            return
        }
    }
    res.redirect("/")
    res.end()
})
express.get('/discord',function(req,res){
    res.redirect("https://discord.gg/PtEPwUP8qG")
})
express.get('/login',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/login.html").toString()
    doc.window.document.getElementById("iframe-login").remove()
    //<meta name="robots" content="noindex">
    let meta = doc.window.document.createElement("meta")
    meta.setAttribute("name","robots")
    meta.setAttribute("content","noindex")
    doc.window.document.head.appendChild(meta)
    res.send(doc.serialize())
    res.end()
})
express.get('/users/*\w/profile',function(req,res,next){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (data.users[Number(req.path.split("/")[2])]==undefined){
        next()
        return
    }
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/profile.html").toString())
            doc.window.document.querySelector("script").innerHTML+="\ndocument.title=\""+data.users[Number(req.path.split("/")[2])].usernames[0]+" - BOBLOX\""
            doc.window.document.getElementById("profile-username").innerHTML=data.users[Number(req.path.split("/")[2])].usernames[0]
            res.send(doc.serialize()).end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/profile.html").toString()
    doc.window.document.querySelector("script").innerHTML+="\ndocument.title=\""+data.users[Number(req.path.split("/")[2])].usernames[0]+" - BOBLOX\""
    doc.window.document.getElementById("profile-username").innerHTML=data.users[Number(req.path.split("/")[2])].usernames[0]
    res.send(doc.serialize()).end()
})
express.get('/robots.txt',function(req,res){
    res.sendFile(pkg.path.join(__dirname,"static","robots.txt"))
})
express.get('*\w',function(req,res){
    let path = decodeURIComponent(req.path)
    //log("GET "+path)
    if (Object.keys(req.query).includes("contentOnly")){
        if (req.query.contentOnly=="true"){
            if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
                if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
                    let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/404.html").toString())
                    doc.window.document.querySelector(".btn-control-md.btn-fixed-width").href="/home"
                    if (res.statusCode==403){
                        doc.window.document.getElementById("messageHeader").innerHTML="Access Denied"
                        doc.window.document.getElementById("message").innerHTML="403 | You don't have permission to view this page"
                        doc.window.document.getElementById("errorImage").src="/static/403.png"
                    }else{
                        res.status(404)
                    }
                    res.send(doc.serialize())
                    res.end()
                    return
                }
            }
            let doc = new pkg.jsdom.JSDOM(pkg.fs.readFileSync("app/404.html").toString())
            if (res.statusCode==403){
                doc.window.document.getElementById("messageHeader").innerHTML="Access Denied"
                doc.window.document.getElementById("message").innerHTML="403 | You don't have permission to view this page"
                doc.window.document.getElementById("errorImage").src="/static/403.png"
            }else{
                res.status(404)
            }
            res.send(doc.serialize())
            res.end()
            //res.end()
            return
        }
    }
    let doc = template(req)
    doc.window.document.getElementById("content").innerHTML = pkg.fs.readFileSync("app/404.html").toString()
    doc.window.document.title="BOBLOX.collabai.lol"
    if (Object.keys(req.cookies).includes(".BOBLOSECURITY")){
        if (Object.keys(data.sessions).includes(req.cookies[".BOBLOSECURITY"])){
            doc.window.document.querySelector(".btn-control-md.btn-fixed-width").href="/home"
        }
    }
    if (res.statusCode==403){
        doc.window.document.getElementById("messageHeader").innerHTML="Access Denied"
        doc.window.document.getElementById("message").innerHTML="403 | You don't have permission to view this page"
        doc.window.document.getElementById("errorImage").src="/static/403.png"
    }else{
        res.status(404)
    }
    res.send(doc.serialize())
    res.end()
})

http.on('request',express)
http.listen(config.port)