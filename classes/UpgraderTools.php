<?php

namespace PsOneSixMigrator;

class UpgraderTools
{
    /**
     * configFilename contains all configuration specific to the autoupgrade module
     *
     * @var string
     * @access public
     */
    const CONFIG_FILENAME = 'config.var';
    /**
     * during upgradeFiles process,
     * this files contains the list of queries left to upgrade in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_UPGRADE_QUERIES_LIST = 'queriesToUpgrade.list';
    /**
     * during upgradeFiles process,
     * this files contains the list of files left to upgrade in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_UPGRADE_FILE_LIST = 'filesToUpgrade.list';
    /**
     * during upgradeModules process,
     * this files contains the list of modules left to upgrade in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_UPGRADE_MODULE_LIST = 'modulesToUpgrade.list';
    /**
     * during upgradeFiles process,
     * this files contains the list of files left to upgrade in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const FILES_DIFF = 'filesDiff.list';
    /**
     * during backupFiles process,
     * this files contains the list of files left to save in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_BACKUP_FILE_LIST = 'filesToBackup.list';
    /**
     * during backupDb process,
     * this files contains the list of tables left to save in a serialized array.
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_BACKUP_DB_LIST = 'tablesToBackup.list';
    /**
     * during restoreDb process,
     * this file contains a serialized array of queries which left to execute for restoring database
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_RESTORE_QUERY_LIST = 'queryToRestore.list';
    /**
     * during restoreFiles process,
     * this file contains difference between queryToRestore and queries present in a backupFiles archive
     * (this file is deleted in init() method if you reload the page)
     */
    const TO_REMOVE_FILE_LIST = 'filesToRemove.list';
    /**
     * during restoreFiles process,
     * contains list of files present in backupFiles archive
     */
    const FROM_ARCHIVE_FILE_LIST = 'filesFromArchive.list';
    /**
     * `MAIL_CUSTOM_LIST` contains list of mails files which are customized,
     * relative to original files for the current PrestaShop version
     */
    const MAIL_CUSTOM_LIST = 'mails-custom.list';
    /**
     * `TRANSLATIONS_CUSTOM_LIST` contains list of mails files which are customized,
     * relative to original files for the current PrestaShop version
     */
    const TRANSLATIONS_CUSTOM_LIST = 'translations-custom.list';

    public $autoupgradePath;
    public $autoupgradeDir = 'autoupgrade';
    /**
     * modules_addons is an array of array(id_addons => name_module).
     *
     * @var array
     * @access public
     */
    public $modules_addons = [];
    public $downloadPath;
    public $backupPath;
    public $latestPath;
    public $tmpPath;

    public $root_writable;
    public $root_writable_report;
    public $module_version;
    public $lastAutoupgradeVersion = '';
    public $destDownloadFilename = 'prestashop.zip';

    /** @var array $error */
    public $errors = [];

    // Performance variables
    /** @var int $loopBackupFiles */
    public static $loopBackupFiles = 400;
    /**
     * Used for translations
     *
     * @var int $maxBackupFileSize
     */
    public static $maxBackupFileSize = 15728640;
    /** @var int $loopBackupDbTime */
    public static $loopBackupDbTime = 6;
    /** @var int $maxWrittenAllowed */
    public static $maxWrittenAllowed = 4194304;
    /** @var int $loopUpgradeFiles */
    public static $loopUpgradeFiles = 600;
    public static $loopRestoreFiles = 400; // json, xml
    public static $loopRestoreQueryTime = 6;
    public static $loopUpgradeModulesTime = 6;
    public static $loopRemoveSamples = 400;

    /** @var UpgraderTools $instance */
    protected static $instance;

    /**
     * Los UpgraderToolos Singletonos
     *
     * @return static
     *
     * @since 1.0.0
     */
    public static function getInstance()
    {
        if (!isset(static::$instance) && !is_object(static::$instance)) {
            static::$instance = new static();
        }

        return static::$instance;
    }

    protected function __construct()
    {
        $this->initPath();
    }

    /**
     * create some required directories if they does not exists
     *
     * Also set nextParams (removeList and filesToUpgrade) if they
     * exists in currentParams
     *
     */
    public function initPath()
    {
        // If not exists in this sessions, "create"
        // session handling : from current to next params
        if (isset($this->currentParams['removeList'])) {
            $this->nextParams['removeList'] = $this->currentParams['removeList'];
        }

        if (isset($this->currentParams['filesToUpgrade'])) {
            $this->nextParams['filesToUpgrade'] = $this->currentParams['filesToUpgrade'];
        }

        if (isset($this->currentParams['modulesToUpgrade'])) {
            $this->nextParams['modulesToUpgrade'] = $this->currentParams['modulesToUpgrade'];
        }

        // set autoupgradePath, to be used in backupFiles and backupDb config values
        $this->autoupgradePath = _PS_ADMIN_DIR_.DIRECTORY_SEPARATOR.$this->autoupgradeDir;
        // directory missing
        if (!file_exists($this->autoupgradePath)) {
            if (!mkdir($this->autoupgradePath)) {
                $this->errors[] = sprintf($this->l('unable to create directory %s'), $this->autoupgradePath);
            }
        }

        if (!is_writable($this->autoupgradePath)) {
            $this->errors[] = sprintf($this->l('Unable to write in the directory "%s"'), $this->autoupgradePath);
        }

        $this->downloadPath = $this->autoupgradePath.DIRECTORY_SEPARATOR.'download';
        if (!file_exists($this->downloadPath)) {
            if (!mkdir($this->downloadPath)) {
                $this->errors[] = sprintf($this->l('unable to create directory %s'), $this->downloadPath);
            }
        }

        $this->backupPath = $this->autoupgradePath.DIRECTORY_SEPARATOR.'backup';
        $tmp = "order deny,allow\ndeny from all";
        if (!file_exists($this->backupPath)) {
            if (!mkdir($this->backupPath)) {
                $this->errors[] = sprintf($this->l('unable to create directory %s'), $this->backupPath);
            }
        }
        if (!file_exists($this->backupPath.DIRECTORY_SEPARATOR.'index.php')) {
            if (!copy(_PS_ROOT_DIR_.DIRECTORY_SEPARATOR.'config'.DIRECTORY_SEPARATOR.'index.php', $this->backupPath.DIRECTORY_SEPARATOR.'index.php')) {
                $this->errors[] = sprintf($this->l('unable to create file %s'), $this->backupPath.DIRECTORY_SEPARATOR.'index.php');
            }
        }
        if (!file_exists($this->backupPath.DIRECTORY_SEPARATOR.'.htaccess')) {
            if (!file_put_contents($this->backupPath.DIRECTORY_SEPARATOR.'.htaccess', $tmp)) {
                $this->errors[] = sprintf($this->l('unable to create file %s'), $this->backupPath.DIRECTORY_SEPARATOR.'.htaccess');
            }
        }

        // directory missing
        $this->latestPath = $this->autoupgradePath.DIRECTORY_SEPARATOR.'latest';
        if (!file_exists($this->latestPath)) {
            if (!mkdir($this->latestPath)) {
                $this->errors[] = sprintf($this->l('unable to create directory %s'), $this->latestPath);
            }
        }

        $this->tmpPath = $this->autoupgradePath.DIRECTORY_SEPARATOR.'tmp';
        if (!file_exists($this->tmpPath)) {
            if (!mkdir($this->tmpPath)) {
                $this->errors[] = sprintf($this->l('unable to create directory %s'), $this->tmpPath);
            }
        }
    }

    protected function initializePerformance()
    {
        // Performance settings, if your server has a low memory size, lower these values
        $perfArray = [
            'loopBackupFiles'        => [     400,      800,     1600],
            'maxBackupFileSize'      => [15728640, 31457280, 62914560],
            'loopBackupDbTime'       => [       6,       12,       25],
            'maxWrittenAllowed'      => [ 4194304,  8388608, 16777216],
            'loopUpgradeFiles'       => [     600,     1200,     2400],
            'loopRestoreFiles'       => [     400,      800,     1600],
            'loopRestoreQueryTime'   => [       6,       12,       25],
            'loopUpgradeModulesTime' => [       6,       12,       25],
            'loopRemoveSamples'      => [     400,      800,     1600],
        ];
        switch (\AdminThirtyBeesMigrateController::getConfig('PS_AUTOUP_PERFORMANCE')) {
            case 3:
                foreach ($perfArray as $property => $values) {
                    self::$$property = $values[2];
                }
                break;
            case 2:
                foreach ($perfArray as $property => $values) {
                    self::$$property = $values[1];
                }
                break;
            case 1:
            default:
                foreach ($perfArray as $property => $values) {
                    self::$$property = $values[0];
                }
        }
    }

    /**
     * @param mixed  $string
     * @param string $class
     * @param bool   $addslashes
     * @param bool   $htmlentities
     *
     * @return mixed|string
     *
     * @since 1.0.0
     */
    protected function l($string, $class = 'AdminThirtyBeesMigrateController', $addslashes = false, $htmlentities = true)
    {
        // need to be called in order to populate $classInModule
        $str = \AdminThirtyBeesMigrateController::findTranslation('psonesixmigrator', $string, 'AdminThirtyBeesMigrateController');
        $str = $htmlentities ? str_replace('"', '&quot;', htmlentities($str, ENT_QUOTES, 'utf-8')) : $str;
        $str = $addslashes ? addslashes($str) : stripslashes($str);

        return $str;
    }
}