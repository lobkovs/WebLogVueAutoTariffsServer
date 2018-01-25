var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var config = require('../config.js');
var pause = require('connect-pause');
var pretty = require('prettysize');
var _ = require('lodash');

/* ************************* */
/* ************************* */
/* ***** GET Files List ***** */
/* ************************* */
/* ************************* */
router.get('/', function(req, res, next) {
	// var files = GetFileList();
	// res.render('index', { 'files': files, 'averageTime': getAverageTime(files) });
	// console.log('req', req);
	res.render('index');
});

/* ************************** */
/* ************************** */
/* ***** POST Files List ***** */
/* ************************** */
/* ************************** */
router.post('/getLogs', function(req, res, next) {
	var files = GetFileList();
	res.send({ 'files': files, 'averageTime': getAverageTime(files) });
});

/* ************************** */
/* ************************** */
/* ***** POST File List ***** */
/* ************************** */
/* ************************** */
router.post('/getInfo/:id', function(req, res, next) {
	res.send(GetFileFullInfo(req.params.id));
});

/* ************************** */
/* ************************** */
/* ***** POST Show File ***** */
/* ************************** */
/* ************************** */
router.post('/show/:name', function(req, res, next) {
		// Сформируем путь к файлу
		var logPath = path.join(config.remoteLogs, req.params.name);

		// Проверим существования файла
		if (fs.existsSync(logPath)) { // Файл существует
			var answer = new Object(); // Обьект ответа

			var offset = req.body.offset || 0; // Смещение чтения
			var chunkSize = 1024 * 512; // 512 Kb, размер блока чтения
			var chunkBuffer = new Buffer(chunkSize);
			var fp = fs.openSync(logPath, 'r'); // Поток чтения
			var bytesRead = 0; //Кол-во прочитанных байт

			// Синхронно читаем данные из потока
			bytesRead = fs.readSync(fp, chunkBuffer, 0, chunkSize, offset);
			// Запомним где закончили читать
			offset += bytesRead;
			// Преобразуем в строку, то что прочитали
			var str = chunkBuffer.slice(0, bytesRead).toString();
			// Последний блок чтения,
			// если прочитанный блок меньше, чем задано,
			// тогда это конец файла
			if(bytesRead < chunkSize) { answer.end = true; }

			// Заполним ранее созданный обьект ответа
			answer.html = str; // Прочитанная стркоа
			answer.len = offset; // Кол-во байт смещения
			answer.size = fs.fstatSync(fp).size; // Полный размер файла

			// Отправим ответ
			res.send(answer);
		} else { // Файл не существует
				// Отправим "Not Found"
				res.send(404);
		}
})

router.post('/delete/:id', function(req, res, next) {
	// Сформируем путь к файлу
	var logPath = path.join(config.remoteLogs, req.params.id);
	var deleteFileName = path.join(config.remoteLogs, 'del_' + req.params.id);
	// Файл существует
	if (fs.existsSync(logPath)) {
		// Создадим пустой файл
		fs.writeFile(deleteFileName, `delete ${deleteFileName}`, function(err) {
			if (err) throw res.send(500, {'error' : err});

			res.send(200, 'Файл успешно удалён!');
		});
	} else {
		res.send(404, 'Файл отсутствует!');
	}
})

// ***
// Возвращает список файлов
// ***
function GetFileList() {
	var files = [];
	// Читаем папку
	var filesArr = fs.readdirSync(config.remoteLogs);

	// Перебираем массив файлов в папке и генерируем ответ
	_.forEachRight(filesArr, function(file) {
		try {
				// Пропускаем файл выполнения или ошибок
				if (file.search(/^exec/i) == 0 ||
						file.search(/^error/i) == 0 ||
						file.search(/^del/i) == 0)
						return;

				// Пропускаем если найден флаг удалённого файла
				if (fs.existsSync(path.join(config.remoteLogs, 'del_' + file)))
					return;

				files.push(GetFileFullInfo(file));
		} catch (e) {
				console.log(e);
		}
	});

	return files;
}

// ***
// Возвращает полную информацию о файле
// ***
function GetFileFullInfo(file) {
	var fullInfo = new Object();
	// Статус
	fullInfo.status = GetStatus(file);
	// Имя файла
	fullInfo.name = file;
	// Сообщение статуса
	fullInfo.statusMessage = GetStatusMessage(fullInfo.status);
	// Время выполнения
	fullInfo.execTime = GetExecTime(file);
	// Время выполнения в мс
	fullInfo.execTimeMs = GetExecTimeMs(file);
	// Размер файла
	fullInfo.size = GetFileSize(file);
	return fullInfo;
}

// ***
// Возвращает размер файла
// ***
function GetFileSize(fileName) {
	return pretty(GetFileSizeByte(fileName));
}

// ***
// Возвращает размер файла в байтах
// ***
function GetFileSizeByte(fileName) {
	var info = fs.statSync(path.join(config.remoteLogs, fileName));
	return info.size;
}

// ***
// Возвращает описание статус
// ***
function GetStatusMessage(status) {
	message = '';
	switch (status) {
			case 'exec':
					message = "Выполняется";
					break;
			case 'error':
					message = "Ошибка";
					break;
			default:
					message = 'Выполнено'
					break;
	}

	return message;
}

// ***
// Возвращает статус файла
// ***
function GetStatus(file) {
	var status = 'done';

	// Exec
	if (fs.existsSync(path.join(config.remoteLogs, 'exec_' + file))) {
			status = 'exec';
	}

	// Error
	if (fs.existsSync(path.join(config.remoteLogs, 'error_' + file))) {
			status = 'error';
	}

	return status;
}

// ***
// Возвращает время выполнения файла
// ***
function GetExecTime(file) {
	var absolutePath = path.join(config.remoteLogs, file);
	var regexText = /Время выполнения:\s\d{2}:\d{2}:\d{2}/;
	var content = fs.readFileSync(absolutePath, { 'encoding': 'utf-8' });

	// Fine line with target text
	var e = content.match(regexText);

	if (e == null)
		return '--:--:--';

	var targetText = e[0];
	var regexpTime = /\d{2}:\d{2}:\d{2}/;
	// Find time in target text
	var time = targetText.match(regexpTime)[0];
	return time;
}

// ***
// Возвращает время выполнения файла в мс
// ***
function GetExecTimeMs(file) {
	var stringTime = GetExecTime(file);
	return getSecondsFromTimeString(stringTime);
}

// ***
// Возвращает разницу времени
// ***
function getAverageTime(files) {
	var resultTime = 0;

	files.forEach(function(item, i) {
		if (!item.execTime)
			return;

		resultTime += getSecondsFromTimeString(item.execTime);
	});
	return elapsedTimeFormatFromSeconds(Math.floor(resultTime / files.length));
}

// ***
// Возвращает кол-во секунда из строки времени
// ***
function getSecondsFromTimeString(time) {
	// Разбиваем и заменяем некорректные данные
	var timeArr = time.split(':').map(function(elem) {
		// Обнуляем если неправильный формат
		if (!elem.match(/\d{2}/i))
			return '0';
		return elem;
	})

	return parseInt(timeArr[2])
					+ (parseInt(timeArr[0]) * 3600)
					+ (parseInt(timeArr[1]) * 60);
}

// ***
// Добавляет лидирущний ноль к значению
// ***
function checkLeadZero(value) {
	if (value < 10) {
		return '0' + value;
	} else {
		return value;
	}
}

// Return HH:MM:SS format from input seconds
function elapsedTimeFormatFromSeconds(sec) {
	var hours = Math.floor(sec / 3600);
	var minutes = Math.floor((sec - (hours * 3600)) / 60);
	var seconds = sec - (hours * 3600) - (minutes * 60);

	return checkLeadZero(hours) + ':' + checkLeadZero(minutes) + ':' + checkLeadZero(seconds);
}

module.exports = router;