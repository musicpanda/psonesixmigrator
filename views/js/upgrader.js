(function () {
  function initializeUpgrader() {
    if (typeof $ === 'undefined' || typeof window.upgrader === 'undefined') {
      setTimeout(initializeUpgrader, 100);

      return;
    }

    function ucFirst(str) {
      if (str.length > 0) {
        return str[0].toUpperCase() + str.substring(1);
      }
      else {
        return str;
      }
    }

    function cleanInfo() {
      $("#infoStep").html("reset<br/>");
    }

    function updateInfoStep(msg) {
      if (msg) {
        $("#infoStep").append(msg + "<div class=\"clear\"></div>");
        $("#infoStep").prop({ scrollTop: $("#infoStep").prop("scrollHeight") }, 1);
      }
    }

    function addError(arrError) {
      if (typeof(arrError) != "undefined" && arrError.length) {
        $("#errorDuringUpgrade").show();
        for (i = 0; i < arrError.length; i++) {
          $("#infoError").append(arrError[i] + "<div class=\"clear\"></div>");
        }
        // Note : jquery 1.6 make uses of prop() instead of attr()
        $("#infoError").prop({ scrollTop: $("#infoError").prop("scrollHeight") }, 1);
      }
    }

    function addQuickInfo(arrQuickInfo) {
      if (arrQuickInfo) {
        $("#quickInfo").show();
        for (i = 0; i < arrQuickInfo.length; i++) {
          $("#quickInfo").append(arrQuickInfo[i] + "<div class=\"clear\"></div>");
        }
        // Note : jquery 1.6 make uses of prop() instead of attr()
        $("#quickInfo").prop({ scrollTop: $("#quickInfo").prop("scrollHeight") }, 1);
      }
    }

    window.upgrader.firstTimeParams = window.upgrader.firstTimeParams.nextParams;
    window.upgrader.firstTimeParams.firstTime = "1";

// js initialization : prepare upgrade and rollback buttons
    $(document).ready(function () {
      $("select[name=channel]").change(function (e) {
        $("select[name=channel]").find("option").each(function () {
          if ($(this).is(":selected")) {
            $("#for-" + $(this).attr("id")).show();
          } else {
            $("#for-" + $(this).attr("id")).hide();
          }
        });

        refreshChannelInfos();
      });

      function refreshChannelInfos() {
        var val = $("select[name=channel]").find("option:selected").val();
        $.ajax({
          type: "POST",
          url: window.upgrader.ajaxLocation,
          async: true,
          data: {
            dir: window.upgrader.dir,
            token: window.upgrader.token,
            autoupgradeDir: window.upgrader.autoupgradeDir,
            tab: "AdminThirtyBeesMigrate",
            action: "getChannelInfo",
            ajax: "1",
            params: { channel: val }
          },
          success: function (res, textStatus, jqXHR) {
            if (isJsonString(res)) {
              res = $.parseJSON(res);
            } else {
              res = { nextParams: { status: "error" } };
            }

            var answer = res.nextParams.result;
            if (typeof(answer) != "undefined") {
              $("#channel-infos").replaceWith(answer.div);
            }
            if (typeof(answer) != "undefined" && answer.available) {
              $("#channel-infos .all-infos").show();
            }
            else if (typeof(answer) != "undefined") {
              $("#channel-infos").html(answer.div);
              $("#channel-infos .all-infos").hide();
            }
          },
          error: function (res, textStatus, jqXHR) {
            if (textStatus == "timeout" && action == "download") {
              updateInfoStep("Your server cannot download the file. Please upload it first by ftp in your admin/autoupgrade directory");
            }
            else {
              // technical error : no translation needed
              $("#checkPrestaShopFilesVersion").html("<img src=\"../img/admin/warning.gif\" /> Error Unable to check md5 files");
            }
          }
        })
      }

      $(document).ready(function () {
        $("div[id|=for]").hide();
        $("select[name=channel]").change();

        $("#upgradeNow17").click(function (e) {
          if (!isAllConditionOk()) {
            e.preventDefault();
            alert("You need to check all condition")
          } else {
            prepareNextButton("#upgradeNow17", window.upgrader.firstTimeParams);
            $(this).click();
          }
        });

      });

      // the following prevents to leave the page at the innappropriate time
      $.xhrPool = [];
      $.xhrPool.abortAll = function () {
        $.each(this, function (jqXHR) {
          if (jqXHR && (jqXHR.readystate != 4)) {
            jqXHR.abort();
          }
        });
      };
      $(".upgradestep").click(function (e) {
        e.preventDefault();
        // $.scrollTo("#options")
      });

      // set timeout to 120 minutes (before aborting an ajax request)
      $.ajaxSetup({ timeout: 7200000 });

      // prepare available button here, without params ?
      prepareNextButton("#upgradeNow", window.upgrader.firstTimeParams);

      /**
       * reset rollbackParams js array (used to init rollback button)
       */
      $("select[name=restoreName]").change(function () {
        $(this).next().remove();
        // show delete button if the value is not 0
        if ($(this).val() != 0) {
          $(this).after("<a class=\"button confirmBeforeDelete\" href=\"index.php?tab=AdminThirtyBeesMigrate&token=" + window.upgrader.token + "&amp;deletebackup&amp;name=" + $(this).val() + "\"> <img src=\"../img/admin/disabled.gif\" />Delete</a>");
          $(this).next().click(function (e) {
            if (!confirm("Are you sure you want to delete this backup?")) {
              e.preventDefault();
            }
          });
        }

        if ($("select[name=restoreName]").val() != 0) {
          $("#rollback").removeAttr("disabled");
          var rollbackParams = jQuery.extend(true, {}, window.upgrader.firstTimeParams);

          delete rollbackParams.backupName;
          delete rollbackParams.backupFilesFilename;
          delete rollbackParams.backupDbFilename;
          delete rollbackParams.restoreFilesFilename;
          delete rollbackParams.restoreDbFilenames;

          // init new name to backup
          rollbackParams.restoreName = $("select[name=restoreName]").val();
          prepareNextButton("#rollback", rollbackParams);
          // Note : theses buttons have been removed.
          // they will be available in a future release (when DEV_MODE and MANUAL_MODE enabled)
          // prepareNextButton("#restoreDb", rollbackParams);
          // prepareNextButton("#restoreFiles", rollbackParams);
        }
        else {
          $("#rollback").attr("disabled", "disabled");
        }
      });

    });

    function showConfigResult(msg, type) {
      if (type == null) {
        type = "conf";
      }
      $("#configResult").html("<div class=\"" + type + "\">" + msg + "</div>").show();
      if (type == "conf") {
        $("#configResult").delay(3000).fadeOut("slow", function () {
          location.reload();
        });
      }
    }

// reuse previousParams, and handle xml returns to calculate next step
// (and the correct next param array)
// a case has to be defined for each requests that returns xml


    function startProcess(type) {
      // hide useless divs, show activity log
      $("#informationBlock,#comparisonBlock,#currentConfigurationBlock,#backupOptionsBlock,#upgradeOptionsBlock,#upgradeButtonBlock").slideUp("fast");
      $(".autoupgradeSteps a").addClass("button");
      $("#hideStep17, #hideStep17basic, #activityLogBlock").show();
      $("#hideStep17-2").hide();

      $(window).bind("beforeunload", function (e) {
        if (confirm(window.upgrader.txtError[38])) {
          $.xhrPool.abortAll();
          $(window).unbind("beforeunload");
          return true;
        } else {
          if (type == "upgrade") {
            e.returnValue = false;
            e.cancelBubble = true;
            if (e.stopPropagation) {
              e.stopPropagation();
            }
            if (e.preventDefault) {
              e.preventDefault();
            }
          }
        }
      });
    }

    function afterUpdateConfig(res) {
      var params = res.nextParams;
      var config = params.config;
      var oldChannel = $("select[name=channel] option.current");
      if (config.channel != oldChannel.val()) {
        var newChannel = $("select[name=channel] option[value=" + config.channel + "]");
        oldChannel.removeClass("current");
        oldChannel.html(oldChannel.html().substr(2));
        newChannel.addClass("current");
        newChannel.html("* " + newChannel.html());
      }
      if (res.error == 1) {
        showConfigResult(res.next_desc, "error");
      } else {
        showConfigResult(res.next_desc);
      }
      $("#upgradeNow").unbind();
      $("#upgradeNow").replaceWith("<a class=\"button-autoupgrade\" href=\"" + window.upgrader.currentIndex + "&token=" + window.upgrader.token + "\">Click to refresh the page and use the new configuration</a>");
    }

    function isAllConditionOk() {
      var isOk = true;

      $("input[name=\"goToUpgrade[]\"]").each(function () {
        if (!($(this).is(":checked"))) {
          isOk = false;
        }
      });

      return isOk;
    }

    function afterUpgradeNow(res) {
      startProcess("upgrade");
      $("#upgradeNow").unbind();
      $("#upgradeNow").replaceWith("<span id=\"upgradeNow\" class=\"button-autoupgrade\">Migrating to thirty bees...</span>");
    }

    function afterUpgradeComplete(res) {
      var params = res.nextParams
      $("#pleaseWait").hide();
      if (params.warning_exists == "false") {
        $("#upgradeResultCheck")
          .addClass("conf")
          .removeClass("fail")
          .html("<p>Upgrade complete</p>")
          .show();
        $("#infoStep").html("<h3>Upgrade Complete!</h3>");
      } else {
        var params = res.nextParams;
        $("#pleaseWait").hide();
        $("#upgradeResultCheck")
          .addClass("fail")
          .removeClass("ok")
          .html("<p>Upgrade complete, but warning notifications has been found.</p>")
          .show("slow");
        $("#infoStep").html("<h3>Upgrade complete, but warning notifications has been found.</h3>");
      }

      var todo_list = [
        "Cookies have changed, you will need to log in again once you refreshed the page",
        "Javascript and CSS files have changed, please clear your browser cache with CTRL-F5",
        "Please check that your front-office theme is functional (try to create an account, place an order...",
        "Product images do not appear in the front-office? Try regenerating the thumbnails in Preferences > Images",
        "Do not forget to reactivate your shop once you have checked everything!"
      ];

      var todo_ul = "<ul>";
      $("#upgradeResultToDoList")
        .addClass("hint clear")
        .html("<h3>ToDo list:</h3>");
      for (var i in todo_list) {
        todo_ul += "<li>" + todo_list[i] + "</li>";
      }
      todo_ul += "</ul>";
      $("#upgradeResultToDoList").append(todo_ul);
      $("#upgradeResultToDoList").show();

      $(window).unbind("beforeunload");
    }

    function afterError(res) {
      var params = res.nextParams;
      if (params.next == "") {
        $(window).unbind("beforeunload");
      }
      $("#pleaseWait").hide();

      addQuickInfo(["unbind :) "]);
    }

    function afterRollback(res) {
      startProcess("rollback");
    }

    function afterRollbackComplete(res) {
      var params = res.nextParams
      $("#pleaseWait").hide();
      $("#upgradeResultCheck")
        .addClass("ok")
        .removeClass("fail")
        .html("<p>Restoration complete.</p>")
        .show("slow");
      updateInfoStep("<h3>Restoration complete.</h3>");
      $(window).unbind();
    }


    function afterRestoreDb(params) {
      // $("#restoreBackupContainer").hide();
    }

    function afterRestoreFiles(params) {
      // $("#restoreFilesContainer").hide();
    }

    function afterBackupFiles(res) {
      // params = res.nextParams;
      // if (params.stepDone)
    }

    /**
     * afterBackupDb display the button
     *
     */
    function afterBackupDb(res) {
      var params = res.nextParams;
      if (res.stepDone && typeof(PS_AUTOUP_BACKUP) != "undefined" && PS_AUTOUP_BACKUP == true) {
        $("#restoreBackupContainer").show();
        $("select[name=restoreName]").children("options").removeAttr("selected");
        $("select[name=restoreName]").append("<option selected=\"selected\" value=\"" + params.backupName + "\">" + params.backupName + "</option>");
        $("select[name=restoreName]").change();
      }
    }

    window.upgrader.availableFunctions = {
      startProcess: startProcess,
      afterUpdateConfig: afterUpdateConfig,
      isAllConditionOk: isAllConditionOk,
      afterUpgradeNow: afterUpgradeNow,
      afterUpgradeComplete: afterUpgradeComplete,
      afterError: afterError,
      afterRollback: afterRollback,
      afterRollbackComplete: afterRollbackComplete,
      afterRestoreDb: afterRestoreDb,
      afterRestoreFiles: afterRestoreFiles,
      afterBackupFiles: afterBackupFiles,
      afterBackupDb: afterBackupDb
    };


    function call_function(func) {
      window.upgrader.availableFunctions[func].apply(this, Array.prototype.slice.call(arguments, 1));
    }

    function doAjaxRequest(action, nextParams) {
      if (typeof(window.upgrader._PS_MODE_DEV_) !== 'undefined' && window.upgrader._PS_MODE_DEV_) {
        addQuickInfo(["[DEV] ajax request : " + action]);
      }
      $("#pleaseWait").show();
      req = $.ajax({
        type: "POST",
        url: window.upgrader.ajaxLocation,
        async: true,
        data: {
          dir: window.upgrader.dir,
          ajax: "1",
          token: window.upgrader.token,
          autoupgradeDir: window.token.autoupgradeDir,
          tab: "AdminThirtyBeesMigrate",
          action: action,
          params: nextParams
        },
        beforeSend: function (jqXHR) {
          $.xhrPool.push(jqXHR);
        },
        complete: function (jqXHR) {
          // just remove the item to the "abort list"
          $.xhrPool.pop();
          // $(window).unbind("beforeunload");
        },
        success: function (res, textStatus, jqXHR) {
          $("#pleaseWait").hide();
          try {
            res = $.parseJSON(res);
          }
          catch (e) {
            res = { status: "error", nextParams: nextParams };
            alert("Javascript error (parseJSON) detected for action \"" + action + "\"Starting recovery process...");
          }
          addQuickInfo(res.nextQuickInfo);
          addError(res.nextErrors);
          updateInfoStep(res.next_desc);
          window.upgrader.currentParams = res.nextParams;
          if (res.status == "ok") {
            $("#" + action).addClass("done");
            if (res.stepDone) {
              $("#" + action).addClass("stepok");
            }
            // if a function "after[action name]" exists, it should be called now.
            // This is used for enabling restore buttons for example
            var funcName = "after" + ucFirst(action);
            if (typeof funcName == "string" && eval("typeof " + funcName) == "function") {
              call_function(funcName, res);
            }

            handleSuccess(res, action);
          }
          else {
            // display progression
            $("#" + action).addClass("done");
            $("#" + action).addClass("steperror");
            if (action != "rollback"
              && action != "rollbackComplete"
              && action != "restoreFiles"
              && action != "restoreDb"
              && action != "rollback"
              && action != "noRollbackFound"
            ) {
              handleError(res, action);
            } else {
              alert("Error detected during [" + action + "]");
            }
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          $("#pleaseWait").hide();
          if (textStatus == "timeout") {
            if (action == "download") {
              updateInfoStep("Your server cannot download the file. Please upload it first by ftp in your admin/autoupgrade directory");
            } else {
              updateInfoStep("[Server Error] Timeout:The request exceeded the max_time_limit. Please change your server configuration.");
            }
          }
          else {
            updateInfoStep("[Ajax / Server Error for action " + action + "] textStatus: \"" + textStatus + " \" errorThrown:\"" + errorThrown + " \" jqXHR: \" " + jqXHR.responseText + "\"");
          }
        }
      });
      return req;
    }

    /**
     * prepareNextButton make the button button_selector available, and update the nextParams values
     *
     * @param button_selector $button_selector
     * @param nextParams $nextParams
     * @return void
     */
    function prepareNextButton(button_selector, nextParams) {
      $(button_selector).unbind();
      $(button_selector).click(function (e) {
        e.preventDefault();
        $("#currentlyProcessing").show();

        window.upgrader.action = button_selector.substr(1);
        window.upgrader.res = doAjaxRequest(window.upgrader.action, nextParams);
      });
    }

    /**
     * handleSuccess
     * res = {error:, next:, next_desc:, nextParams:, nextQuickInfo:,status:"ok"}
     * @param res $res
     * @return void
     */
    function handleSuccess(res, action) {
      if (res.next != "") {

        $("#" + res.next).addClass("nextStep");
        if (window.upgrader.manualMode && (action != "rollback"
          && action != "rollbackComplete"
          && action != "restoreFiles"
          && action != "restoreDb"
          && action != "rollback"
          && action != "noRollbackFound")) {
          prepareNextButton("#" + res.next, res.nextParams);
          alert("Manually go to button " + res.next);
        }
        else {
          // if next is rollback, prepare nextParams with rollbackDbFilename and rollbackFilesFilename
          if (res.next == "rollback") {
            res.nextParams.restoreName = ""
          }
          doAjaxRequest(res.next, res.nextParams);
          // 2) remove all step link (or show them only in dev mode)
          // 3) when steps link displayed, they should change color when passed if they are visible
        }
      }
      else {
        // Way To Go, end of upgrade process
        addQuickInfo(["End of process"]);
      }
    }

// res = {nextParams, next_desc}
    function handleError(res, action) {
      // display error message in the main process thing
      // In case the rollback button has been deactivated, just re-enable it
      $("#rollback").removeAttr("disabled");
      // auto rollback only if current action is upgradeFiles or upgradeDb
      if (action == "upgradeFiles" || action == "upgradeDb" || action == "upgradeModules") {
        $(".button-autoupgrade").html("Operation canceled. Checking for restoration...");
        res.nextParams.restoreName = res.nextParams.backupName;
        // FIXME: show backup name
        if (confirm("Do you want to restore from backup ``?")) {
          doAjaxRequest("rollback", res.nextParams);
        }
      }
      else {
        $(".button-autoupgrade").html("Operation canceled. An error happened.");
        $(window).unbind();
      }
    }

// ajax to check md5 files
    function addModifiedFileList(title, fileList, css_class, container) {
      var subList = $("<ul class=\"changedFileList " + css_class + "\"></ul>");

      $(fileList).each(function (k, v) {
        $(subList).append("<li>" + v + "</li>");
      });
      $(container).append("<h3><a class=\"toggleSublist\" href=\"#\" >" + title + "</a> (" + fileList.length + ")</h3>");
      $(container).append(subList);
      $(container).append("<br/>");

    }

    if (!window.upgrader.upgradeTabFileExists) {
      $(document).ready(function () {
        $("#checkPrestaShopFilesVersion").html("<img src=\"../img/admin/warning.gif\" /> [TECHNICAL ERROR] ajax-upgradetab.php is missing. please reinstall the module");
      });
    } else {
      function isJsonString(str) {
        try {
          typeof(str) != "undefined" && JSON.parse(str);
        } catch (e) {
          return false;
        }
        return true;
      }

      $(document).ready(function () {
        $.ajax({
          type: "POST",
          url: window.upgrader.ajaxLocation,
          async: true,
          data: {
            dir: window.upgrader.dir,
            token: window.upgrader.token,
            autoupgradeDir: window.upgrader.autoupgradeDir,
            tab: window.upgrader.tab,
            action: "checkFilesVersion",
            ajax: "1",
            params: {}
          },
          success: function (res, textStatus, jqXHR) {
            if (isJsonString(res)) {
              res = $.parseJSON(res);
            } else {
              res = { nextParams: { status: "error" } };
            }
            var answer = res.nextParams;
            $("#checkPrestaShopFilesVersion").html("<span> " + answer.msg + " </span> ");
            if ((answer.status == "error") || (typeof(answer.result) == "undefined")) {
              $("#checkPrestaShopFilesVersion").prepend("<img src=\"../img/admin/warning.gif\" /> ");
            } else {
              $("#checkPrestaShopFilesVersion").prepend("<img src=\"../img/admin/warning.gif\" /> ");
              $("#checkPrestaShopFilesVersion").append("<a id=\"toggleChangedList\" class=\"button\" href=\"\">See or hide the list</a><br/>");
              $("#checkPrestaShopFilesVersion").append("<div id=\"changedList\" style=\"display:none \"><br/>");
              if (answer.result.core.length) {
                addModifiedFileList("Core file(s)'", answer.result.core, "changedImportant", "#changedList");
              }
              if (answer.result.mail.length) {
                addModifiedFileList("Mail file(s)", answer.result.mail, "changedNotice", "#changedList");
              }
              if (answer.result.translation.length) {
                addModifiedFileList("Translation file(s)", answer.result.translation, "changedNotice", "#changedList");
              }

              $("#toggleChangedList").bind("click", function (e) {
                e.preventDefault();
                $("#changedList").toggle();
              });
              $(".toggleSublist").die().live("click", function (e) {
                e.preventDefault();
                $(this).parent().next().toggle();
              });
            }
          }
          ,
          error: function (res, textStatus, jqXHR) {
            if (textStatus == "timeout" && action == "download") {
              updateInfoStep("Your server cannot download the file. Please upload it to your FTP server, and put it in your /[admin]/autoupgrade directory.");
            }
            else {
              // technical error : no translation needed
              $("#checkPrestaShopFilesVersion").html("<img src=\"../img/admin/warning.gif\" /> Error: Unable to check md5 files");
            }
          }
        });
        $.ajax({
          type: "POST",
          url: window.upgrader.ajaxLocation,
          async: true,
          data: {
            dir: window.upgrader.dir,
            token: window.upgrader.token,
            autoupgradeDir: window.upgrader.autoupgradeDir,
            tab: window.upgrader.tab,
            action: "compareReleases",
            ajax: "1",
            params: {}
          },
          success: function (res, textStatus, jqXHR) {
            if (isJsonString(res)) {
              res = $.parseJSON(res);
            } else {
              res = { nextParams: { status: "error" } };
            }
            var answer = res.nextParams;
            $("#checkPrestaShopModifiedFiles").html("<span> " + answer.msg + " </span> ");
            if ((answer.status == "error") || (typeof(answer.result) == "undefined")) {
              $("#checkPrestaShopModifiedFiles").prepend("<img src=\"../img/admin/warning.gif\" /> ");
            } else {
              $("#checkPrestaShopModifiedFiles").prepend("<img src=\"../img/admin/warning.gif\" /> ");
              $("#checkPrestaShopModifiedFiles").append("<a id=\"toggleDiffList\" class=\"button\" href=\"\">See or hide the list</a><br/>");
              $("#checkPrestaShopModifiedFiles").append("<div id=\"diffList\" style=\"display:none \"><br/>");
              if (answer.result.deleted.length) {
                addModifiedFileList("These files will be deleted", answer.result.deleted, "diffImportant", "#diffList");
              }
              if (answer.result.modified.length) {
                addModifiedFileList("These files will be modified", answer.result.modified, "diffImportant", "#diffList");
              }

              $("#toggleDiffList").bind("click", function (e) {
                e.preventDefault();
                $("#diffList").toggle();
              });
              $(".toggleSublist").die().live("click", function (e) {
                e.preventDefault();
                // this=a, parent=h3, next=ul
                $(this).parent().next().toggle();
              });
            }
          },
          error: function (res, textStatus, jqXHR) {
            if (textStatus == "timeout" && action == "download") {
              updateInfoStep("Your server cannot download the file. Please upload it first by ftp in your admin/autoupgrade directory");
            }
            else {
              // technical error : no translation needed
              $("#checkPrestaShopFilesVersion").html("<img src=\"../img/admin/warning.gif\" /> Error: Unable to check md5 files");
            }
          }
        })
      });
    }

// advanced/normal mode
    $("input[name=btn_adv]").click(function (e) {
      if ($("#advanced:visible").length) {
        switch_to_normal();
      } else {
        switch_to_advanced();
      }
    });

    function switch_to_advanced() {
      $("input[name=btn_adv]").val("Less options");
      $("#advanced").show();
    }

    function switch_to_normal() {
      $("input[name=btn_adv]").val("More options (Expert mode)");
      $("#advanced").hide();
    }

    $(document).ready(function () {
      if (window.upgrader.channel === 'major') {
        switch_to_normal();
      } else {
        switch_to_advanced();
      }
      $("input[name|=submitConf]").bind("click", function (e) {
        var params = {};
        var newChannel = $("select[name=channel] option:selected").val();
        var oldChannel = $("select[name=channel] option.current").val();
        if (oldChannel != newChannel) {
          if (newChannel == "major"
            || newChannel == "minor"
            || newChannel == "rc"
            || newChannel == "beta"
            || newChannel == "alpha") {
            params.channel = newChannel;
          }

          if (newChannel == "private") {
            if (($("input[name=private_release_link]").val() == "") || ($("input[name=private_release_md5]").val() == "")) {
              showConfigResult("Link and MD5 hash cannot be empty", "error");
              return false;
            }
            params.channel = "private";
            params.private_release_link = $("input[name=private_release_link]").val();
            params.private_release_md5 = $("input[name=private_release_md5]").val();
            if ($("input[name=private_allow_major]").is(":checked")) {
              params.private_allow_major = 1;
            } else {
              params.private_allow_major = 0;
            }
          }
          if (newChannel == "archive") {
            var archive_prestashop = $("select[name=archive_prestashop] option:selected").val();
            var archive_num = $("input[name=archive_num]").val();
            if (archive_num == "") {
              showConfigResult("You need to enter the version number associated with the archive.");
              return false;
            }
            if (archive_prestashop == "") {
              showConfigResult("No archive has been selected.");
              return false;
            }
            params.channel = "archive";
            params.archive_prestashop = archive_prestashop;
            params.archive_num = archive_num;
          }
          if (newChannel == "directory") {
            params.channel = "directory";
            params.directory_prestashop = $("select[name=directory_prestashop] option:selected").val();
            var directory_num = $("input[name=directory_num]").val();
            if (directory_num == "" || directory_num.indexOf(".") == -1) {
              showConfigResult("You need to enter the version number associated with the directory.");
              return false;
            }
            params.directory_num = $("input[name=directory_num]").val();
          }
        }
        // note: skipBackup is currently not used
        if ($(this).attr("name") == "submitConf-skipBackup") {
          var skipBackup = $("input[name=submitConf-skipBackup]:checked").length;
          if (skipBackup == 0 || confirm("Please confirm that you want to skip the backup.")) {
            params.skip_backup = $("input[name=submitConf-skipBackup]:checked").length;
          } else {
            $("input[name=submitConf-skipBackup]:checked").removeAttr("checked");
            return false;
          }
        }

        // note: preserveFiles is currently not used
        if ($(this).attr("name") == "submitConf-preserveFiles") {
          var preserveFiles = $("input[name=submitConf-preserveFiles]:checked").length;
          if (confirm("Please confirm that you want to preserve file options.")) {
            params.preserve_files = $("input[name=submitConf-preserveFiles]:checked").length;
          } else {
            $("input[name=submitConf-skipBackup]:checked").removeAttr("checked");
            return false;
          }
        }
        window.upgrader.res = doAjaxRequest("updateConfig", params);
      });
    });
  }

  initializeUpgrader();
})();
